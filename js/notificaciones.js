function agregarNotificacion(texto){

    notificaciones.unshift({
        texto,
        fecha:new Date()
    });

    actualizarNotificaciones();
}

function actualizarNotificaciones(){

    const lista =
    document.getElementById(
        "listaNotificaciones"
    );

    const contador =
    document.getElementById(
        "contador"
    );

    lista.innerHTML = "";

    contador.textContent =
    notificaciones.length;

    notificaciones.forEach(n=>{

        lista.innerHTML += `
        <div class="notificacion">
            ${n.texto}
        </div>
        `;
    });
}

function iniciarPanelNotificaciones(){

    const boton =
    document.getElementById(
        "abrirNotificaciones"
    );

    if(!boton) return;

    boton.addEventListener(
        "click",
        ()=>{

            const panel =
            document.getElementById(
                "panelNotificaciones"
            );

            panel.style.display =
            panel.style.display ===
            "block"
            ?
            "none"
            :
            "block";
        }
    );
}