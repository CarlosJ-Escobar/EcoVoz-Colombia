function enviarMensaje(){

    const input =
    document.getElementById(
        "chatInput"
    );

    const texto =
    input.value.trim();

    if(!texto) return;

    mensajes.push({
        texto,
        alias: usuarioActual.alias,
        fecha:new Date()
    });

    renderizarMensajes();

    input.value = "";
}

function renderizarMensajes(){

    const contenedor =
    document.getElementById(
        "chatMensajes"
    );

    contenedor.innerHTML = "";

    mensajes.forEach(msg=>{

        contenedor.innerHTML += `
        <div class="mensaje">

            💬 <strong>${escaparHTML(msg.alias)}:</strong> ${escaparHTML(msg.texto)}

        </div>
        `;
    });

    contenedor.scrollTop =
    contenedor.scrollHeight;
}