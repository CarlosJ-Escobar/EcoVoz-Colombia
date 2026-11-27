// =====================================
// PANEL DE COMENTARIOS
// =====================================

let comentariosDe = null;   // id de la publicación abierta

function crearElemento(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto) elemento.textContent = texto;
    return elemento;
}

function obtenerPanelComentarios() {

    let panel = document.getElementById("panelComentarios");
    if (panel) return panel;

    panel = crearElemento("dialog", "panel-comentarios");
    panel.id = "panelComentarios";
    panel.setAttribute("aria-labelledby", "comentariosTitulo");
    panel.innerHTML = `
        <div class="comentarios-cabecera">
            <div>
                <h3 id="comentariosTitulo">Comentarios</h3>
                <p id="comentariosPublicacion"></p>
            </div>
            <button type="button" id="cerrarComentarios" aria-label="Cerrar">✕</button>
        </div>

        <div id="comentariosLista" class="comentarios-lista"></div>

        <form id="formComentario" class="comentarios-escribir">
            <textarea id="textoComentario" rows="1" maxlength="1000"
                aria-label="Escribe un comentario" placeholder="Escribe un comentario…"></textarea>
            <button type="submit" id="enviarComentario" disabled>Enviar</button>
        </form>`;
    document.body.appendChild(panel);

    const caja = panel.querySelector("#textoComentario");
    const boton = panel.querySelector("#enviarComentario");
    const formulario = panel.querySelector("#formComentario");
    let enviando = false;

    panel.querySelector("#cerrarComentarios").addEventListener("click", () => panel.close());

    // Cerrar al tocar fuera del panel
    panel.addEventListener("click", e => {
        if (e.target === panel) panel.close();
    });

    caja.addEventListener("input", () => boton.disabled = !caja.value.trim());

    // Enter envía; Mayús + Enter hace salto de línea
    caja.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            formulario.requestSubmit();
        }
    });

    formulario.addEventListener("submit", async e => {
        e.preventDefault();
        const texto = caja.value.trim();
        if (!texto || enviando) return;

        enviando = true;
        boton.disabled = true;
        boton.textContent = "Enviando…";

        // Si falla, el texto se conserva para reintentar
        if (await guardarComentario(comentariosDe, texto)) {
            caja.value = "";
            const lista = panel.querySelector("#comentariosLista");
            lista.scrollTop = lista.scrollHeight;
        }

        enviando = false;
        boton.textContent = "Enviar";
        boton.disabled = !caja.value.trim();
        caja.focus();
    });

    return panel;
}

// Se llama también cuando llegan comentarios de otras personas
function actualizarPanelComentarios() {

    const panel = document.getElementById("panelComentarios");
    const pub = publicaciones.find(p => p.id === comentariosDe);
    if (!panel || !pub) return;

    panel.querySelector("#comentariosPublicacion").textContent = pub.titulo;

    const lista = panel.querySelector("#comentariosLista");
    lista.innerHTML = "";

    if (!pub.comentarios.length) {
        lista.appendChild(crearElemento("p", "comentarios-vacio", "Aún no hay comentarios. ¡Sé el primero!"));
        return;
    }

    // Cada comentario se guarda como "alias: texto"
    pub.comentarios.forEach(comentario => {
        const corte = comentario.indexOf(": ");
        const alias = corte > 0 ? comentario.slice(0, corte) : "Anónimo";
        const texto = corte > 0 ? comentario.slice(corte + 2) : comentario;

        const fila = crearElemento("div", "comentario-fila");
        const burbuja = crearElemento("div", "comentario-burbuja");
        burbuja.append(crearElemento("strong", "", alias), crearElemento("p", "", texto));
        fila.append(crearElemento("span", "comentario-avatar", Array.from(alias)[0].toUpperCase()), burbuja);
        lista.appendChild(fila);
    });
}

function agregarComentario(index) {

    const panel = obtenerPanelComentarios();
    const caja = panel.querySelector("#textoComentario");

    if (comentariosDe !== publicaciones[index].id) {
        caja.value = "";
        panel.querySelector("#enviarComentario").disabled = true;
    }

    comentariosDe = publicaciones[index].id;
    actualizarPanelComentarios();
    panel.showModal();
    caja.focus();
}
