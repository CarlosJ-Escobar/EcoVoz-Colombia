// =====================================
// INICIALIZACIÓN
// =====================================

document.addEventListener("DOMContentLoaded", () => {

    const inputImagen =
        document.getElementById("imagen");

    if (inputImagen) {

        inputImagen.addEventListener(
            "change",
            mostrarPreviewImagenes
        );
    }
});

// =====================================
// CREAR PUBLICACIÓN
// =====================================

function crearPublicacion() {

    const titulo =
        document.getElementById("titulo").value.trim();

    const descripcion =
        document.getElementById("descripcion").value.trim();

    const ubicacion =
        document.getElementById("ubicacion").value.trim();

    if (!titulo || !descripcion) {

        alert(
            "Debe completar título y descripción"
        );

        return;
    }

    const inputImagen =
        document.getElementById("imagen");

    const archivos =
        Array.from(inputImagen.files);

    if (archivos.length === 0) {

        finalizarPublicacion([]);

        return;
    }

    const imagenes = [];

    let procesadas = 0;

    archivos.forEach(file => {

        const lector =
            new FileReader();

        lector.onload = function (e) {

            imagenes.push(
                e.target.result
            );

            procesadas++;

            if (
                procesadas ===
                archivos.length
            ) {

                finalizarPublicacion(
                    imagenes
                );
            }
        };

        lector.readAsDataURL(file);
    });
}

// =====================================
// FINALIZAR PUBLICACIÓN
// =====================================

function finalizarPublicacion(imagenes) {

    const nuevaPublicacion = {

        id: Date.now(),

        titulo:
            document.getElementById(
                "titulo"
            ).value.trim(),

        descripcion:
            document.getElementById(
                "descripcion"
            ).value.trim(),

        ubicacion:
            document.getElementById(
                "ubicacion"
            ).value.trim(),

        categoria:
            document.getElementById(
                "categoria"
            ).value,

        lat: puntoSeleccionado?.lat ?? null,

        lng: puntoSeleccionado?.lng ?? null,

        firma: usuarioActual.alias,

        autorId: usuarioActual.id,

        fecha:
            new Date().toLocaleString(),

        imagenes,

        apoyos: 0,

        firmas: [],

        comentarios: [],

        reacciones: {
            like: 0,
            love: 0,
            care: 0,
            wow: 0,
            sad: 0
        }
    };

    publicaciones.unshift(
        nuevaPublicacion
    );

    guardarDatos();

    agregarNotificacion(
        "Nueva publicación creada"
    );

    renderizarPublicaciones();

    limpiarFormulario();

    quitarPunto();

    irASeccion(`publicacion-${nuevaPublicacion.id}`);

    ubicarPorTexto(nuevaPublicacion);
}

// =====================================
// VISTA PREVIA DE IMÁGENES
// =====================================

function mostrarPreviewImagenes(event) {

    const preview =
        document.getElementById(
            "previewImagenes"
        );

    if (!preview) return;

    preview.innerHTML = "";

    const archivos =
        Array.from(
            event.target.files
        );

    archivos.forEach(file => {

        const lector =
            new FileReader();

        lector.onload = function (e) {

            const imagen =
                document.createElement(
                    "img"
                );

            imagen.src =
                e.target.result;

            imagen.classList.add(
                "preview-img"
            );

            preview.appendChild(
                imagen
            );
        };

        lector.readAsDataURL(file);
    });
}

// =====================================
// RENDERIZAR PUBLICACIONES
// =====================================

function renderizarPublicaciones() {

    const contenedor =
        document.getElementById(
            "publicaciones"
        );

    if (!contenedor) return;

    contenedor.innerHTML = "";

    publicaciones.forEach(
        (pub, index) => {

            let comentariosHTML = "";

            pub.comentarios.forEach(
                comentario => {

                    comentariosHTML += `
                    <div class="comentario">
                        💬 ${escaparHTML(comentario)}
                    </div>
                    `;
                }
            );

            let galeriaHTML = "";

            if (
                pub.imagenes &&
                pub.imagenes.length > 0
            ) {

                pub.imagenes.forEach(
                    imagen => {

                        galeriaHTML += `
                        <img src="${escaparHTML(imagen)}"
                            class="imagen-publicacion"
                            onclick="abrirModalImagen(this.src)"
                            alt="Imagen publicación">
                        `;
                    }
                );
            }

            contenedor.innerHTML += `

            <div class="publicacion" id="publicacion-${pub.id}">

                <h3>${escaparHTML(pub.titulo)}</h3>

                <p>${escaparHTML(pub.descripcion)}</p>

                <p class="ubicacion">
                    📍 ${escaparHTML(pub.ubicacion)}
                </p>

                <p class="autor">
                    ✍️ ${escaparHTML(pub.firma)}
                </p>

                <small>
                    ${pub.fecha}
                </small>

                <div class="galeria-publicacion">
                    ${galeriaHTML}
                </div>

                <div class="acciones">

                    ${tieneCoordenadas(pub) ? `
                    <button onclick="enfocarPublicacion(${pub.id})">
                        🗺️ Ver en el mapa
                    </button>` : ""}

                    <button
                        onclick="apoyar(${index})">

                        👍 Apoyar
                        (${pub.apoyos})

                    </button>

                    <button
                        onclick="firmar(${index})">

                        ✍️ Firmar
                        (${pub.firmas.length})

                    </button>

                    <button
                        onclick="agregarComentario(${index})">

                        💬 Comentar

                    </button>

                </div>

                <div class="acciones">

                    <button
                        onclick="reaccion(${index}, 'like')">

                        👍 ${pub.reacciones.like}

                    </button>

                    <button
                        onclick="reaccion(${index}, 'love')">

                        ❤️ ${pub.reacciones.love}

                    </button>

                    <button
                        onclick="reaccion(${index}, 'care')">

                        🤗 ${pub.reacciones.care}

                    </button>

                    <button
                        onclick="reaccion(${index}, 'wow')">

                        😮 ${pub.reacciones.wow}

                    </button>

                    <button
                        onclick="reaccion(${index}, 'sad')">

                        😢 ${pub.reacciones.sad}

                    </button>

                </div>

                <div class="comentarios">

                    ${comentariosHTML}

                </div>

            </div>
            `;
        }
    );

    actualizarEstadisticas();

    refrescarMarcadores();
}

// =====================================
// APOYOS
// =====================================

function apoyar(index) {

    publicaciones[index].apoyos++;

    guardarDatos();

    agregarNotificacion(
        "Una publicación recibió apoyo"
    );

    renderizarPublicaciones();
}

// =====================================
// FIRMAS
// =====================================

function firmar(index) {

    const nombre = usuarioActual.alias;

    // Una firma por usuario
    if (publicaciones[index].firmas.includes(nombre)) {
        alert("Ya firmaste esta publicación");
        return;
    }

    publicaciones[index]
        .firmas
        .push(nombre);

    guardarDatos();

    agregarNotificacion(
        "Nueva firma ciudadana"
    );

    renderizarPublicaciones();
}

// =====================================
// REACCIONES
// =====================================

function reaccion(index, tipo) {

    publicaciones[index]
        .reacciones[tipo]++;

    guardarDatos();

    renderizarPublicaciones();
}

// =====================================
// COMENTARIOS
// =====================================

function agregarComentario(index) {

    const comentario =
        prompt(
            "Ingrese su comentario"
        );

    if (!comentario) return;

    publicaciones[index]
        .comentarios
        .push(`${usuarioActual.alias}: ${comentario}`);

    guardarDatos();

    agregarNotificacion(
        "Nuevo comentario agregado"
    );

    renderizarPublicaciones();
}

// =====================================
// MODAL IMÁGENES
// =====================================

function abrirModalImagen(src) {

    const modal =
        document.getElementById(
            "modalImagen"
        );

    const imagen =
        document.getElementById(
            "imagenAmpliada"
        );

    if (!modal || !imagen) return;

    imagen.src = src;

    modal.style.display =
        "flex";
}

function cerrarModalImagen() {

    const modal =
        document.getElementById(
            "modalImagen"
        );

    if (!modal) return;

    modal.style.display =
        "none";
}

// =====================================
// LIMPIAR FORMULARIO
// =====================================

function limpiarFormulario() {

    document.getElementById(
        "titulo"
    ).value = "";

    document.getElementById(
        "descripcion"
    ).value = "";

    document.getElementById(
        "ubicacion"
    ).value = "";

    document.getElementById(
        "categoria"
    ).value = "otro";

    limpiarUbicacionFormulario();

    const inputImagen =
        document.getElementById(
            "imagen"
        );

    if (inputImagen) {
        inputImagen.value = "";
    }

    const preview =
        document.getElementById(
            "previewImagenes"
        );

    if (preview) {
        preview.innerHTML = "";
    }
}