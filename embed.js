const script = document.createElement("script");
script.src = "/app.js";
document.head.appendChild(script);

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "/styles.css";
document.head.appendChild(style);

const container = document.createElement("div");
container.id = "app";
container.innerHTML = "^
document.body.appendChild(container);
