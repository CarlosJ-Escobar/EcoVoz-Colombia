// =====================================
// INICIO DE SESIÓN (local, sin servidor)
// Las cuentas se guardan solo en este navegador.
// =====================================

const CLAVE_USUARIOS = "ecoVozUsuarios";
const CLAVE_SESION = "ecoVozSesion";

let usuarioActual = null;
let pasoAcceso = "correo";   // correo -> entrar | registro

function leerUsuarios() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_USUARIOS)) || [];
    } catch (error) {
        return [];
    }
}

function aHex(bytes) {
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

// La contraseña nunca se guarda: solo su huella (PBKDF2 con sal)
async function cifrarContrasena(contrasena, sal) {
    const clave = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveBits"]
    );
    return aHex(await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: new TextEncoder().encode(sal), iterations: 210000, hash: "SHA-256" },
        clave, 256
    ));
}

async function registrarUsuario(correo, alias, contrasena) {

    if (alias.length < 3) throw new Error("El alias debe tener al menos 3 caracteres");
    if (contrasena.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

    const sal = aHex(crypto.getRandomValues(new Uint8Array(16)));
    const huella = await cifrarContrasena(contrasena, sal);
    const usuarios = leerUsuarios();

    if (usuarios.some(u => u.correo === correo)) {
        throw new Error("Ese correo ya está registrado");
    }
    if (usuarios.some(u => u.alias.toLowerCase() === alias.toLowerCase())) {
        throw new Error("Ese alias ya está en uso");
    }

    const usuario = { id: aHex(crypto.getRandomValues(new Uint8Array(8))), correo, alias, sal, huella };
    usuarios.push(usuario);
    localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(usuarios));
    return usuario;
}

async function validarUsuario(correo, contrasena) {
    const usuario = leerUsuarios().find(u => u.correo === correo);
    if (!usuario || await cifrarContrasena(contrasena, usuario.sal) !== usuario.huella) {
        throw new Error("Contraseña incorrecta");
    }
    return usuario;
}

// ---------- Interfaz ----------

function elementoAcceso(id) {
    return document.getElementById(id);
}

function mostrarErrorAcceso(texto) {
    elementoAcceso("accesoError").textContent = texto;
}

function cambiarPaso(paso) {

    pasoAcceso = paso;
    mostrarErrorAcceso("");

    const esCorreo = paso === "correo";
    const esRegistro = paso === "registro";

    elementoAcceso("accesoCorreo").readOnly = !esCorreo;
    elementoAcceso("grupoAlias").hidden = !esRegistro;
    elementoAcceso("grupoContrasena").hidden = esCorreo;
    elementoAcceso("accesoVolver").hidden = esCorreo;

    elementoAcceso("accesoContrasena").value = "";
    elementoAcceso("accesoContrasena").autocomplete = esRegistro ? "new-password" : "current-password";

    elementoAcceso("accesoTitulo").textContent =
        esRegistro ? "Crea tu cuenta" : esCorreo ? "Ingresa a EcoVoz" : "Hola de nuevo";

    elementoAcceso("accesoBoton").textContent =
        esRegistro ? "Crear cuenta" : esCorreo ? "Continuar con correo" : "Iniciar sesión";

    elementoAcceso(esRegistro ? "accesoAlias" : esCorreo ? "accesoCorreo" : "accesoContrasena").focus();
}

async function enviarAcceso(evento) {

    evento.preventDefault();
    mostrarErrorAcceso("");

    const correo = elementoAcceso("accesoCorreo").value.trim().toLowerCase();
    const contrasena = elementoAcceso("accesoContrasena").value;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        mostrarErrorAcceso("Escribe un correo válido");
        return;
    }

    if (pasoAcceso === "correo") {
        cambiarPaso(leerUsuarios().some(u => u.correo === correo) ? "entrar" : "registro");
        return;
    }

    if (!window.crypto?.subtle) {
        mostrarErrorAcceso("Abre la página en http://localhost o con https");
        return;
    }

    const boton = elementoAcceso("accesoBoton");
    boton.disabled = true;

    try {
        const usuario = pasoAcceso === "registro"
            ? await registrarUsuario(correo, elementoAcceso("accesoAlias").value.trim(), contrasena)
            : await validarUsuario(correo, contrasena);

        localStorage.setItem(CLAVE_SESION, usuario.id);
        abrirSesion(usuario);
    } catch (error) {
        mostrarErrorAcceso(error.message);
    } finally {
        boton.disabled = false;
    }
}

// Bloquea el resto de la página mientras no haya sesión
function bloquearPagina(bloqueada) {
    elementoAcceso("acceso").hidden = !bloqueada;
    document.body.classList.toggle("sin-sesion", bloqueada);
    Array.from(document.body.children)
        .filter(e => e.id !== "acceso" && e.tagName !== "SCRIPT")
        .forEach(e => e.inert = bloqueada);
}

function abrirSesion(usuario) {
    usuarioActual = usuario;
    elementoAcceso("perfilAlias").textContent = usuario.alias;
    elementoAcceso("perfilCorreo").textContent = usuario.correo;
    elementoAcceso("formAcceso").reset();
    bloquearPagina(false);
}

function cerrarSesion() {
    localStorage.removeItem(CLAVE_SESION);
    window.history.replaceState(null, "", window.location.pathname);
    // Recargar borra de la pantalla los datos de la sesión anterior
    window.location.reload();
}

function iniciarAcceso() {

    elementoAcceso("formAcceso").addEventListener("submit", enviarAcceso);
    elementoAcceso("accesoVolver").addEventListener("click", () => cambiarPaso("correo"));
    elementoAcceso("btnCerrarSesion").addEventListener("click", cerrarSesion);

    // Si la sesión cambia en otra pestaña, actualiza esta
    window.addEventListener("storage", e => {
        if (e.key === CLAVE_SESION) window.location.reload();
    });

    const id = localStorage.getItem(CLAVE_SESION);
    const usuario = leerUsuarios().find(u => u.id === id);

    if (usuario) {
        abrirSesion(usuario);
    } else {
        bloquearPagina(true);
        cambiarPaso("correo");
    }
}
