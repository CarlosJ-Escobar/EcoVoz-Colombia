document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const botones = [
        document.getElementById("menuToggle"),   // computador
        document.getElementById("menuTab")       // celular
    ];

    if (!sidebar || !overlay || botones.includes(null)) {
        console.error("No se encontró sidebar, overlay o los botones del menú");
        return;
    }

    function abrirMenu(abierto) {
        sidebar.classList.toggle("active", abierto);
        overlay.classList.toggle("active", abierto);
        botones.forEach(b => b.setAttribute("aria-expanded", abierto));
    }

    botones.forEach(boton => boton.addEventListener(
        "click",
        () => abrirMenu(!sidebar.classList.contains("active"))
    ));

    overlay.addEventListener("click", () => abrirMenu(false));

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") abrirMenu(false);
    });

    document.querySelectorAll(".nav-link").forEach(
        link => link.addEventListener("click", () => abrirMenu(false))
    );
});
