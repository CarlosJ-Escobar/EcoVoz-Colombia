// =====================================
// MAPA AMBIENTAL (Leaflet + OpenStreetMap)
// =====================================

const CATEGORIAS = {
    contaminacion: { nombre: "Contaminación", icono: "🏭", color: "#d93025" },
    deforestacion: { nombre: "Deforestación", icono: "🪓", color: "#8d5524" },
    agua:          { nombre: "Agua",          icono: "💧", color: "#1a73e8" },
    fauna:         { nombre: "Fauna",         icono: "🐾", color: "#e37400" },
    propuesta:     { nombre: "Propuesta",     icono: "🌱", color: "#188038" },
    otro:          { nombre: "Otro",          icono: "📌", color: "#5f6368" }
};

const CENTRO_COLOMBIA = [4.5709, -74.2973];
const ZOOM_PAIS = 6;
const URL_NOMINATIM = "https://nominatim.openstreetmap.org";

let capaReportes = null;
let capaUbicacion = null;
let filtroActivo = "todos";
let puntoSeleccionado = null;   // coordenadas del formulario
let consultaPunto = 0;          // descarta respuestas atrasadas
let turnoNominatim = Promise.resolve();
const marcadoresPorId = new Map();

// ---------- Utilidades ----------

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML.replace(/"/g, "&quot;");
}

function tieneCoordenadas(pub) {
    return Number.isFinite(pub.lat) && Number.isFinite(pub.lng);
}

function categoriaDe(pub) {
    return CATEGORIAS[pub.categoria] || CATEGORIAS.otro;
}

function textoCoordenadas(lat, lng) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function urlComoLlegar(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function avisarMapa(texto) {
    const aviso = document.getElementById("mapaAviso");
    aviso.textContent = texto;
    aviso.hidden = !texto;
    clearTimeout(avisarMapa.temporizador);
    if (texto) {
        avisarMapa.temporizador = setTimeout(() => aviso.hidden = true, 5000);
    }
}

// El servicio gratuito Nominatim permite máximo 1 consulta por segundo.
function consultarNominatim(ruta) {
    const respuesta = turnoNominatim.then(async () => {
        const r = await fetch(`${URL_NOMINATIM}/${ruta}&format=jsonv2&accept-language=es`);
        if (!r.ok) throw new Error(`Nominatim ${r.status}`);
        return r.json();
    });
    turnoNominatim = respuesta
        .catch(() => {})
        .then(() => new Promise(ok => setTimeout(ok, 1100)));
    return respuesta;
}

function buscarLugares(texto, limite = 5) {
    return consultarNominatim(
        `search?q=${encodeURIComponent(texto)}&countrycodes=co&limit=${limite}`
    );
}

async function obtenerDireccion(lat, lng) {
    try {
        const datos = await consultarNominatim(`reverse?lat=${lat}&lon=${lng}`);
        return datos.display_name || textoCoordenadas(lat, lng);
    } catch (error) {
        return textoCoordenadas(lat, lng);
    }
}

// ---------- Inicio ----------

function iniciarMapa() {

    const elemento = document.getElementById("map");

    // Evita inicializar dos veces
    if (!elemento || mapa) return;

    if (typeof L === "undefined") {
        elemento.textContent = "No se pudo cargar el mapa. Revisa tu conexión a internet.";
        return;
    }

    mapa = L.map(elemento, { zoomControl: false })
        .setView(CENTRO_COLOMBIA, ZOOM_PAIS);

    // OpenStreetMap exige la cabecera Referer, que no existe al abrir
    // el HTML con doble clic (file://). En ese caso se usan calles de Esri.
    const esArchivoLocal = window.location.protocol === "file:";

    const calles = esArchivoLocal
        ? L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
            { maxZoom: 19, attribution: "Mapa © Esri" }
        )
        : L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "© OpenStreetMap",
                referrerPolicy: "strict-origin-when-cross-origin"
            }
        );

    calles.addTo(mapa);

    const satelite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Imágenes © Esri, Maxar, Earthstar Geographics" }
    );

    L.control.layers(
        { "Mapa": calles, "Satélite": satelite },
        null,
        { position: "topright", collapsed: false }
    ).addTo(mapa);

    L.control.zoom({ position: "bottomright" }).addTo(mapa);
    L.control.scale({ imperial: false }).addTo(mapa);

    capaReportes = L.layerGroup().addTo(mapa);
    capaUbicacion = L.layerGroup().addTo(mapa);

    mapa.on("click", e => seleccionarPunto(e.latlng.lat, e.latlng.lng));

    // Redibuja cuando cambia el tamaño del contenedor
    new ResizeObserver(() => {
        if (elemento.offsetWidth) mapa.invalidateSize();
    }).observe(elemento);

    iniciarControlesMapa();
    refrescarMarcadores();
}

function iniciarControlesMapa() {

    const entrada = document.getElementById("buscarLugar");

    document.getElementById("btnBuscar")
        .addEventListener("click", buscarEnMapa);

    entrada.addEventListener("keydown", e => {
        if (e.key === "Enter") buscarEnMapa();
        if (e.key === "Escape") limpiarResultados();
    });

    document.getElementById("btnMiUbicacion")
        .addEventListener("click", mostrarMiUbicacion);

    document.getElementById("btnVistaPais")
        .addEventListener("click", () => mapa.flyTo(CENTRO_COLOMBIA, ZOOM_PAIS));

    const marco = document.getElementById("mapaMarco");
    const btnPantalla = document.getElementById("btnPantalla");

    if (!marco.requestFullscreen) {
        btnPantalla.hidden = true;
    } else {
        btnPantalla.addEventListener("click", () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else marco.requestFullscreen();
        });
    }

    const filtros = document.getElementById("mapaFiltros");
    const opciones = [["todos", "Todos"]].concat(
        Object.entries(CATEGORIAS).map(([clave, c]) => [clave, `${c.icono} ${c.nombre}`])
    );

    opciones.forEach(([clave, nombre]) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = nombre;
        boton.classList.toggle("activo", clave === filtroActivo);
        boton.addEventListener("click", () => {
            filtroActivo = clave;
            filtros.querySelectorAll("button")
                .forEach(b => b.classList.toggle("activo", b === boton));
            refrescarMarcadores();
        });
        filtros.appendChild(boton);
    });
}

// ---------- Búsqueda ----------

function limpiarResultados() {
    document.getElementById("resultadosBusqueda").innerHTML = "";
}

async function buscarEnMapa() {

    const texto = document.getElementById("buscarLugar").value.trim();
    const lista = document.getElementById("resultadosBusqueda");

    limpiarResultados();
    if (!texto) return;

    avisarMapa("Buscando…");

    try {
        const lugares = await buscarLugares(texto);

        avisarMapa(lugares.length ? "" : "No se encontraron lugares en Colombia");
        lista.innerHTML = "";

        lugares.forEach(lugar => {
            const item = document.createElement("li");
            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = lugar.display_name;
            boton.addEventListener("click", () => {
                const lat = Number(lugar.lat);
                const lng = Number(lugar.lon);
                limpiarResultados();
                mapa.flyTo([lat, lng], 15);
                seleccionarPunto(lat, lng, lugar.display_name);
            });
            item.appendChild(boton);
            lista.appendChild(item);
        });
    } catch (error) {
        avisarMapa("No fue posible buscar. Intenta de nuevo.");
    }
}

// ---------- Punto seleccionado ----------

function quitarPunto() {
    consultaPunto++;
    if (marcadorActual) {
        marcadorActual.remove();
        marcadorActual = null;
    }
}

async function seleccionarPunto(lat, lng, direccion) {

    quitarPunto();
    const consulta = consultaPunto;

    const contenido = document.createElement("div");
    contenido.className = "popup-mapa";
    contenido.innerHTML = `
        <strong>Punto seleccionado</strong>
        <p class="popup-direccion">${escaparHTML(direccion || "Buscando dirección…")}</p>
        <small>${textoCoordenadas(lat, lng)}</small>
        <div class="popup-acciones">
            <button type="button">📝 Publicar aquí</button>
            <a href="${urlComoLlegar(lat, lng)}" target="_blank" rel="noopener">🧭 Cómo llegar</a>
        </div>`;

    contenido.querySelector("button").addEventListener("click", () => {
        fijarUbicacionFormulario(lat, lng, direccion || textoCoordenadas(lat, lng));
        irASeccion("nueva-publicacion");
    });

    marcadorActual = L.marker([lat, lng], { icon: crearIcono("#ea4335", "") })
        .addTo(mapa)
        .bindPopup(contenido)
        .openPopup();

    if (!direccion) {
        direccion = await obtenerDireccion(lat, lng);
        if (consulta !== consultaPunto) return;
        contenido.querySelector(".popup-direccion").textContent = direccion;
    }
}

// ---------- Marcadores de publicaciones ----------

function crearIcono(color, simbolo) {
    return L.divIcon({
        className: "pin-contenedor",
        html: `<span class="pin" style="background:${color}"></span>
               <span class="pin-simbolo">${simbolo}</span>`,
        iconSize: [34, 44],
        iconAnchor: [17, 42],
        popupAnchor: [0, -38]
    });
}

function crearPopupPublicacion(pub) {

    const categoria = categoriaDe(pub);
    const contenido = document.createElement("div");
    const foto = pub.imagenes && pub.imagenes[0];

    contenido.className = "popup-mapa";
    contenido.innerHTML = `
        ${foto ? `<img src="${escaparHTML(foto)}" alt="">` : ""}
        <strong>${escaparHTML(pub.titulo)}</strong>
        <small>${categoria.icono} ${categoria.nombre}${pub.aproximada ? " · ubicación aproximada" : ""}</small>
        <p>${escaparHTML(pub.ubicacion)}</p>
        <div class="popup-acciones">
            <button type="button">💬 Ver publicación</button>
            <a href="${urlComoLlegar(pub.lat, pub.lng)}" target="_blank" rel="noopener">🧭 Cómo llegar</a>
        </div>`;

    contenido.querySelector("button")
        .addEventListener("click", () => irASeccion(`publicacion-${pub.id}`));

    return contenido;
}

function refrescarMarcadores() {

    if (!mapa) return;

    capaReportes.clearLayers();
    marcadoresPorId.clear();

    const lista = document.getElementById("listaReportes");
    lista.innerHTML = "";

    const visibles = publicaciones.filter(pub =>
        tieneCoordenadas(pub) &&
        (filtroActivo === "todos" || (CATEGORIAS[pub.categoria] ? pub.categoria : "otro") === filtroActivo)
    );

    visibles.forEach(pub => {
        const categoria = categoriaDe(pub);

        const marcador = L.marker(
            [pub.lat, pub.lng],
            { icon: crearIcono(categoria.color, categoria.icono), title: pub.titulo }
        )
            .bindPopup(crearPopupPublicacion(pub))
            .addTo(capaReportes);

        marcadoresPorId.set(pub.id, marcador);

        const item = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.innerHTML = `
            <strong>${categoria.icono} ${escaparHTML(pub.titulo)}</strong>
            <span>${escaparHTML(pub.ubicacion)}</span>`;
        boton.addEventListener("click", () => enfocarPublicacion(pub.id));
        item.appendChild(boton);
        lista.appendChild(item);
    });

    if (!visibles.length) {
        lista.innerHTML = "<li class='sin-reportes'>No hay reportes en el mapa. Toca un punto del mapa para crear uno.</li>";
    }
}

function enfocarPublicacion(id) {

    navegar("mapa");   // crea el mapa si aún no existe

    if (!mapa) return;

    // Si el filtro la oculta, vuelve a "Todos"
    if (!marcadoresPorId.has(id)) {
        document.querySelector("#mapaFiltros button").click();
    }

    const marcador = marcadoresPorId.get(id);
    if (!marcador) return;

    document.getElementById("mapaMarco")
        .scrollIntoView({ behavior: "smooth", block: "center" });

    mapa.setView(marcador.getLatLng(), 15);
    marcador.openPopup();
}

// Abre el apartado que contiene el elemento y se desplaza hasta él
function irASeccion(id) {
    const ir = () => {
        const destino = document.getElementById(id);
        if (!destino) return;
        navegar(destino.closest(".vista").id);
        destino.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    if (document.fullscreenElement) document.exitFullscreen().then(ir);
    else ir();
}

// ---------- Geolocalización ----------

function pedirPosicion(alExito) {

    if (!navigator.geolocation) {
        alert("Tu navegador no permite obtener la ubicación");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        posicion => alExito(posicion.coords),
        error => alert(
            error.code === error.PERMISSION_DENIED
                ? "Debes permitir el acceso a tu ubicación en el navegador"
                : "No fue posible obtener tu ubicación"
        ),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function dibujarMiUbicacion(lat, lng, precision) {

    if (!mapa) return;

    capaUbicacion.clearLayers();

    L.circle([lat, lng], { radius: precision, weight: 1, fillOpacity: .12, interactive: false })
        .addTo(capaUbicacion);

    L.circleMarker([lat, lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 })
        .bindPopup("Estás aquí")
        .addTo(capaUbicacion);

    mapa.setView([lat, lng], 16);
}

function mostrarMiUbicacion() {
    pedirPosicion(c => dibujarMiUbicacion(c.latitude, c.longitude, c.accuracy));
}

// Botón "Obtener ubicación" del formulario
function obtenerUbicacion() {
    pedirPosicion(async c => {
        const { latitude: lat, longitude: lng } = c;
        dibujarMiUbicacion(lat, lng, c.accuracy);
        fijarUbicacionFormulario(lat, lng, textoCoordenadas(lat, lng));

        const direccion = await obtenerDireccion(lat, lng);

        // Solo si el usuario no cambió la ubicación mientras tanto
        if (puntoSeleccionado?.lat === lat && puntoSeleccionado?.lng === lng) {
            fijarUbicacionFormulario(lat, lng, direccion);
        }
    });
}

function fijarUbicacionFormulario(lat, lng, texto) {
    puntoSeleccionado = { lat, lng };
    document.getElementById("ubicacion").value = texto;
    document.getElementById("estadoUbicacion").textContent =
        `✅ Punto guardado: ${textoCoordenadas(lat, lng)}`;
}

function limpiarUbicacionFormulario() {
    puntoSeleccionado = null;
    document.getElementById("estadoUbicacion").textContent = "";
}

function elegirEnMapa() {
    irASeccion("mapaMarco");
    avisarMapa("Toca el mapa en el lugar exacto y pulsa «Publicar aquí»");
}

// Ubica publicaciones cuya dirección se escribió a mano
async function ubicarPorTexto(pub) {

    if (tieneCoordenadas(pub) || !pub.ubicacion) return;

    try {
        const [lugar] = await buscarLugares(pub.ubicacion, 1);
        if (!lugar) {
            agregarNotificacion("No se encontró la ubicación; la publicación no aparece en el mapa");
            return;
        }
        pub.lat = Number(lugar.lat);
        pub.lng = Number(lugar.lon);
        pub.aproximada = true;
        guardarDatos();
        renderizarPublicaciones();
    } catch (error) {
        agregarNotificacion("No fue posible ubicar la publicación en el mapa");
    }
}

// Si el usuario edita el texto, el punto anterior deja de ser válido
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ubicacion")
        .addEventListener("input", limpiarUbicacionFormulario);
});
