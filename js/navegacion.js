// =====================================
// NAVEGACIÓN POR APARTADOS
// Cada enlace #apartado muestra solo su vista.
// =====================================

let vistaActual = null;
const posicionesVista = {};   // recuerda el desplazamiento de cada apartado

function mostrarVista(id) {

    const vistas = Array.from(document.querySelectorAll(".vista"));

    if (!vistas.some(v => v.id === id)) id = "inicio";

    if (id !== vistaActual) {

        if (vistaActual) posicionesVista[vistaActual] = window.scrollY;

        vistaActual = id;

        vistas.forEach(v => v.hidden = v.id !== id);

        document.querySelectorAll(".barra-nav a, .sidebar .nav-link").forEach(enlace => {
            const activo = enlace.getAttribute("href") === `#${id}`;
            enlace.classList.toggle("active", activo);
            if (activo) enlace.setAttribute("aria-current", "page");
            else enlace.removeAttribute("aria-current");
        });

        window.scrollTo({ top: posicionesVista[id] || 0, behavior: "instant" });
    }

    // El mapa se crea la primera vez que es visible, para que mida bien
    if (id === "mapa") {
        iniciarMapa();
        mapa?.invalidateSize();
    }
}

// Cambia de apartado desde el código
function navegar(id) {
    if (window.location.hash !== `#${id}`) {
        window.history.pushState(null, "", `#${id}`);
    }
    mostrarVista(id);
}

function iniciarNavegacion() {

    window.history.scrollRestoration = "manual";

    // Cubre los enlaces y los botones atrás / adelante
    window.addEventListener(
        "hashchange",
        () => mostrarVista(window.location.hash.slice(1))
    );

    // Tocar el apartado en el que ya estás vuelve al principio
    document.querySelectorAll(".barra-nav a, .sidebar .nav-link").forEach(enlace => {
        enlace.addEventListener("click", e => {
            if (enlace.getAttribute("href") === `#${vistaActual}`) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });

    mostrarVista(window.location.hash.slice(1));
}
