// =====================================
// MODO COMPARTIDO (Supabase)
// Si hay configuración, reemplaza las funciones locales
// para que todos los usuarios vean los mismos datos.
// Debe cargarse DESPUÉS de los demás archivos .js
// =====================================

if (SUPABASE_URL && SUPABASE_KEY) activarModoCompartido();

function activarModoCompartido() {

    const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
    let numeroCarga = 0;
    let esperaRecarga = null;

    function revisar({ data, error }) {
        if (error) throw error;
        return data;
    }

    function avisarFallo(error) {
        console.error(error);
        alert("No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.");
    }

    // ---------- Lectura ----------

    async function leerPublicaciones() {
        const filas = revisar(await sb.from("publicaciones")
            .select(`*,
                perfiles!publicaciones_autor_fkey(alias),
                interacciones(tipo, perfiles(alias)),
                comentarios(id, texto, perfiles(alias))`)
            .order("creada", { ascending: false })
            .limit(100));

        return filas.map(f => {
            const contar = tipo => f.interacciones.filter(i => i.tipo === tipo).length;
            return {
                id: f.id,
                autorId: f.autor,
                titulo: f.titulo,
                descripcion: f.descripcion,
                ubicacion: f.ubicacion,
                categoria: f.categoria,
                lat: f.lat,
                lng: f.lng,
                aproximada: f.aproximada,
                solucion: f.solucion,
                cerrada: f.cerrado_en ? new Date(f.cerrado_en).toLocaleString() : "",
                imagenes: f.imagenes,
                firma: f.perfiles.alias,
                fecha: new Date(f.creada).toLocaleString(),
                apoyos: contar("apoyo"),
                firmas: f.interacciones.filter(i => i.tipo === "firma").map(i => i.perfiles.alias),
                comentarios: f.comentarios
                    .sort((a, b) => a.id - b.id)
                    .map(c => `${c.perfiles.alias}: ${c.texto}`),
                reacciones: {
                    like: contar("like"), love: contar("love"), care: contar("care"),
                    wow: contar("wow"), sad: contar("sad")
                }
            };
        });
    }

    async function leerMensajes() {
        const filas = revisar(await sb.from("mensajes")
            .select("texto, creado, perfiles(alias)")
            .order("id", { ascending: false })
            .limit(100));

        return filas.reverse().map(f => (
            { texto: f.texto, alias: f.perfiles.alias, fecha: new Date(f.creado) }
        ));
    }

    cargarDatos = async function () {
        if (!usuarioActual) return;
        const carga = ++numeroCarga;
        try {
            const [nuevas, chat] = await Promise.all([leerPublicaciones(), leerMensajes()]);
            if (carga !== numeroCarga) return;   // llegó una carga más reciente
            publicaciones.splice(0, publicaciones.length, ...nuevas);
            mensajes.splice(0, mensajes.length, ...chat);
            renderizarPublicaciones();
            renderizarMensajes();
        } catch (error) {
            console.error(error);
            agregarNotificacion("No se pudieron cargar las publicaciones");
        }
    };

    guardarDatos = function () {};   // cada acción se guarda en la nube

    function programarRecarga() {
        clearTimeout(esperaRecarga);
        esperaRecarga = setTimeout(() => cargarDatos(), 600);
    }

    // ---------- Publicaciones ----------

    // Reduce las fotos para no agotar el espacio gratuito
    async function subirFoto(dataUrl) {
        const imagen = new Image();
        imagen.src = dataUrl;
        await imagen.decode();

        const escala = Math.min(1, 1280 / Math.max(imagen.width, imagen.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(imagen.width * escala);
        lienzo.height = Math.round(imagen.height * escala);

        const dibujo = lienzo.getContext("2d");
        dibujo.fillStyle = "white";
        dibujo.fillRect(0, 0, lienzo.width, lienzo.height);
        dibujo.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

        const archivo = await new Promise(ok => lienzo.toBlob(ok, "image/jpeg", 0.8));
        const ruta = `${usuarioActual.id}/${crypto.randomUUID()}.jpg`;

        revisar(await sb.storage.from("fotos").upload(ruta, archivo, { contentType: "image/jpeg" }));
        return sb.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
    }

    let publicando = false;

    finalizarPublicacion = async function (imagenes) {

        if (publicando) return;

        if (imagenes.length > 5) {
            alert("Máximo 5 fotos por publicación");
            return;
        }

        const valor = id => document.getElementById(id).value.trim();
        const datos = {
            titulo: valor("titulo"),
            descripcion: valor("descripcion"),
            ubicacion: valor("ubicacion"),
            categoria: valor("categoria"),
            lat: puntoSeleccionado?.lat ?? null,
            lng: puntoSeleccionado?.lng ?? null
        };
        const boton = document.querySelector('[onclick="crearPublicacion()"]');

        publicando = true;
        boton.disabled = true;
        boton.textContent = "Publicando…";

        try {
            datos.imagenes = [];
            for (const imagen of imagenes) datos.imagenes.push(await subirFoto(imagen));

            const nueva = revisar(await sb.from("publicaciones").insert(datos).select("id").single());

            limpiarFormulario();
            quitarPunto();
            agregarNotificacion("Nueva publicación creada");
            await cargarDatos();
            irASeccion(`publicacion-${nueva.id}`);
            ubicarPorTexto({ ...datos, id: nueva.id });
        } catch (error) {
            avisarFallo(error);
        } finally {
            publicando = false;
            boton.disabled = false;
            boton.textContent = "Publicar";
        }
    };

    ubicarPorTexto = async function (pub) {
        if (tieneCoordenadas(pub) || !pub.ubicacion) return;
        try {
            const [lugar] = await buscarLugares(pub.ubicacion, 1);
            if (!lugar) {
                agregarNotificacion("No se encontró la ubicación; la publicación no aparece en el mapa");
                return;
            }
            revisar(await sb.from("publicaciones")
                .update({ lat: Number(lugar.lat), lng: Number(lugar.lon), aproximada: true })
                .eq("id", pub.id));
            await cargarDatos();
        } catch (error) {
            agregarNotificacion("No fue posible ubicar la publicación en el mapa");
        }
    };

    // ---------- Apoyos, firmas, reacciones, comentarios, chat ----------

    // Cada usuario puede hacer cada acción una sola vez por publicación
    async function interactuar(index, tipo, aviso) {
        const { error } = await sb.from("interacciones")
            .insert({ publicacion_id: publicaciones[index].id, tipo });

        if (error?.code === "23505") {
            alert("Ya lo hiciste en esta publicación");
            return;
        }
        if (error) return avisarFallo(error);

        if (aviso) agregarNotificacion(aviso);
        await cargarDatos();
    }

    apoyar = index => interactuar(index, "apoyo", "Una publicación recibió apoyo");
    firmar = index => interactuar(index, "firma", "Nueva firma ciudadana");
    reaccion = (index, tipo) => interactuar(index, tipo);

    guardarComentario = async function (id, texto) {
        const { error } = await sb.from("comentarios").insert({ publicacion_id: id, texto });
        if (error) {
            avisarFallo(error);
            return false;
        }

        agregarNotificacion("Nuevo comentario agregado");
        await cargarDatos();
        return true;
    };

    // La base de datos solo permite este cambio al autor
    guardarSolucion = async function (id, solucion) {
        const { data, error } = await sb.from("publicaciones")
            .update({ solucion }).eq("id", id).select("id");

        if (error || !data.length) {
            avisarFallo(error || new Error("Sin permiso para cerrar el caso"));
            return false;
        }

        agregarNotificacion("Caso cerrado como resuelto");
        await cargarDatos();
        return true;
    };

    enviarMensaje = async function () {
        const input = document.getElementById("chatInput");
        const texto = input.value.trim();
        if (!texto) return;

        input.value = "";
        const { error } = await sb.from("mensajes").insert({ texto });
        if (error) {
            input.value = texto;
            return avisarFallo(error);
        }
        await cargarDatos();
    };

    // ---------- Cuentas ----------

    const pasoBase = cambiarPaso;

    cambiarPaso = function (paso) {
        pasoBase(paso);
        elementoAcceso("accesoCrear").hidden = paso !== "entrar";
    };

    enviarAcceso = async function (evento) {

        evento.preventDefault();
        mostrarErrorAcceso("");

        const email = elementoAcceso("accesoCorreo").value.trim().toLowerCase();
        const password = elementoAcceso("accesoContrasena").value;
        const alias = elementoAcceso("accesoAlias").value.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return mostrarErrorAcceso("Escribe un correo válido");
        }
        if (pasoAcceso === "correo") return cambiarPaso("entrar");

        const boton = elementoAcceso("accesoBoton");
        boton.disabled = true;

        try {
            if (pasoAcceso === "registro") {
                if (alias.length < 3) throw "El alias debe tener al menos 3 caracteres";
                if (password.length < 8) throw "La contraseña debe tener al menos 8 caracteres";

                if (!revisar(await sb.rpc("alias_disponible", { nombre: alias }))) {
                    throw "Ese alias ya está en uso";
                }

                const { data, error } = await sb.auth.signUp(
                    { email, password, options: { data: { alias } } }
                );
                if (error?.code === "user_already_exists") throw "Ese correo ya está registrado";
                if (error) throw error;
                if (!data.session) throw "Revisa tu correo para confirmar la cuenta y luego inicia sesión";

                await entrar(data.session.user);
            } else {
                const { data, error } = await sb.auth.signInWithPassword({ email, password });
                if (error?.code === "invalid_credentials") throw "Correo o contraseña incorrectos";
                if (error?.code === "email_not_confirmed") throw "Primero confirma tu correo";
                if (error) throw error;

                await entrar(data.user);
            }
        } catch (error) {
            console.error(error);
            mostrarErrorAcceso(typeof error === "string" ? error : "No fue posible conectar. Intenta de nuevo.");
        } finally {
            boton.disabled = false;
        }
    };

    async function entrar(user) {
        const perfil = revisar(await sb.from("perfiles").select("alias").eq("id", user.id).single());
        abrirSesion({ id: user.id, correo: user.email, alias: perfil.alias });
        await cargarDatos();
        escucharCambios();
    }

    let escuchando = false;

    function escucharCambios() {
        if (escuchando) return;
        escuchando = true;

        const canal = sb.channel("ecovoz");
        ["publicaciones", "interacciones", "comentarios", "mensajes"].forEach(table =>
            canal.on("postgres_changes", { event: "*", schema: "public", table }, programarRecarga)
        );
        canal.subscribe();

        // Respaldo si se perdió la conexión en vivo
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) programarRecarga();
        });
    }

    cerrarSesion = async function () {
        await sb.auth.signOut({ scope: "local" });
        window.history.replaceState(null, "", window.location.pathname);
        window.location.reload();
    };

    iniciarAcceso = async function () {

        const crear = document.createElement("button");
        crear.type = "button";
        crear.id = "accesoCrear";
        crear.className = "acceso-enlace";
        crear.textContent = "No tengo cuenta: crear una";
        crear.hidden = true;
        crear.addEventListener("click", () => cambiarPaso("registro"));
        elementoAcceso("formAcceso").appendChild(crear);

        document.querySelector(".acceso-nota").textContent =
            "Tu alias y tus publicaciones los verán los demás usuarios. Tu correo no.";

        elementoAcceso("formAcceso").addEventListener("submit", e => enviarAcceso(e));
        elementoAcceso("accesoVolver").addEventListener("click", () => cambiarPaso("correo"));
        elementoAcceso("btnCerrarSesion").addEventListener("click", () => cerrarSesion());

        bloquearPagina(true);
        cambiarPaso("correo");

        if (!sb) return mostrarErrorAcceso("No se pudo cargar la conexión. Revisa tu internet y recarga.");

        try {
            const { session } = revisar(await sb.auth.getSession());
            if (session) await entrar(session.user);   // inicio automático
        } catch (error) {
            console.error(error);
            mostrarErrorAcceso("No fue posible recuperar tu sesión. Inicia de nuevo.");
        }
    };
}
