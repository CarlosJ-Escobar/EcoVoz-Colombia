// =====================================
// CERRAR CASO
// Solo quien publicó el caso puede cerrarlo, explicando la solución.
// =====================================

const MINIMO_SOLUCION = 10;

function puedeCerrar(pub) {
    return !pub.solucion && Boolean(pub.autorId) && pub.autorId === usuarioActual?.id;
}

// Contenido extra de cada publicación del foro
function cierreHTML(pub) {

    if (pub.solucion) {
        return `
            <div class="caso-solucion">
                <strong>✅ Caso resuelto</strong>
                <p>${escaparHTML(pub.solucion)}</p>
                <small>Cerrado por ${escaparHTML(pub.firma)} · ${escaparHTML(pub.cerrada)}</small>
            </div>`;
    }

    return puedeCerrar(pub)
        ? `<button type="button" class="btn" onclick="abrirCierre(${pub.id})">✅ Cerrar caso</button>`
        : "";
}

// Guardado local (nube.js lo reemplaza en modo compartido)
function guardarSolucion(id, solucion) {

    const pub = publicaciones.find(p => p.id === id);
    if (!pub || !puedeCerrar(pub)) return false;

    pub.solucion = solucion;
    pub.cerrada = new Date().toLocaleString();

    guardarDatos();
    agregarNotificacion("Caso cerrado como resuelto");
    renderizarPublicaciones();
    return true;
}

function abrirCierre(id) {

    const pub = publicaciones.find(p => p.id === id);
    if (!pub || !puedeCerrar(pub)) return;

    // Se crea uno nuevo cada vez para empezar limpio
    document.getElementById("panelCierre")?.remove();

    const panel = document.createElement("dialog");
    panel.id = "panelCierre";
    panel.className = "panel-comentarios";
    panel.setAttribute("aria-labelledby", "cierreTitulo");
    panel.innerHTML = `
        <div class="comentarios-cabecera">
            <div>
                <h3 id="cierreTitulo">Cerrar caso</h3>
                <p>${escaparHTML(pub.titulo)}</p>
            </div>
            <button type="button" class="cierre-x" aria-label="Cancelar">✕</button>
        </div>
        <form class="cierre-formulario">
            <label for="textoSolucion">¿Cuál fue la solución?</label>
            <textarea id="textoSolucion" maxlength="2000"
                placeholder="Explica qué se hizo, quién ayudó y cómo quedó el lugar"></textarea>
            <small>Mínimo ${MINIMO_SOLUCION} caracteres. Será visible para todos y no se podrá cambiar.</small>
            <button type="submit" class="btn" disabled>Confirmar y cerrar caso</button>
        </form>`;
    document.body.appendChild(panel);

    const caja = panel.querySelector("textarea");
    const boton = panel.querySelector("[type=submit]");
    let enviando = false;

    const incompleto = () => caja.value.trim().length < MINIMO_SOLUCION;

    caja.addEventListener("input", () => boton.disabled = enviando || incompleto());
    panel.querySelector(".cierre-x").addEventListener("click", () => panel.close());

    panel.querySelector("form").addEventListener("submit", async e => {
        e.preventDefault();
        if (enviando || incompleto()) return;

        enviando = true;
        boton.disabled = true;
        boton.textContent = "Cerrando…";

        // Si falla, el texto se conserva para reintentar
        if (await guardarSolucion(id, caja.value.trim())) {
            panel.close();
            return;
        }

        enviando = false;
        boton.disabled = false;
        boton.textContent = "Confirmar y cerrar caso";
    });

    panel.showModal();
    caja.focus();
}
