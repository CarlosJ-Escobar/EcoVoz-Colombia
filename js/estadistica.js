function actualizarEstadisticas(){

    let firmas = 0;
    let apoyos = 0;
    let comentarios = 0;

    publicaciones.forEach(pub=>{

        firmas += pub.firmas.length;

        apoyos += pub.apoyos;

        comentarios +=
        pub.comentarios.length;
    });

    document
    .getElementById(
    "totalPublicaciones"
    ).textContent =
    publicaciones.length;

    document
    .getElementById(
    "totalFirmas"
    ).textContent =
    firmas;

    document
    .getElementById(
    "totalApoyos"
    ).textContent =
    apoyos;

    document
    .getElementById(
    "totalComentarios"
    ).textContent =
    comentarios;
}