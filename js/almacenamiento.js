function guardarDatos(){

    localStorage.setItem(
        "ecoForoPublicaciones",
        JSON.stringify(
            publicaciones
        )
    );
}

function cargarDatos(){

    const datos =
    localStorage.getItem(
        "ecoForoPublicaciones"
    );

    if(!datos) return;

    const publicacionesGuardadas =
    JSON.parse(datos);

    publicaciones.splice(
        0,
        publicaciones.length,
        ...publicacionesGuardadas)}