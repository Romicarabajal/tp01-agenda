/* ==========================================================
   Súper Barrio · Sistema de stock
   Lógica de la app: datos, pantallas, exportar/importar y PWA.
   Uso de IA: código generado con ayuda de Claude (Anthropic) y
   revisado por la docente. Los datos se guardan en localStorage.
   ========================================================== */
"use strict";

(function () {

  /* 1. DATOS ------------------------------------------------ */
  var CLAVE = "superbarrio_datos_v1";
  var CATEGORIAS_INICIALES = ["Almacén", "Bebidas", "Lácteos", "Limpieza", "Frutas y verduras"];

  var datos = cargarDatos();
  var codigoEnEdicion = null; // código del producto que se está editando

  function datosVacios() {
    return { categorias: [], productos: [], movimientos: [] };
  }

  function cargarDatos() {
    try {
      var guardado = localStorage.getItem(CLAVE);
      if (guardado === null) {
        var nuevos = datosVacios();
        nuevos.categorias = CATEGORIAS_INICIALES.slice();
        return nuevos;
      }
      return normalizar(JSON.parse(guardado)) || datosVacios();
    } catch (e) {
      return datosVacios();
    }
  }

  function guardarDatos() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos));
    } catch (e) {
      avisar("No se pudo guardar en este dispositivo.", true);
    }
  }

  // Revisa que un objeto (guardado o importado) tenga la forma correcta.
  // Devuelve datos limpios o null si no sirve.
  function normalizar(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.categorias) || !Array.isArray(obj.productos) || !Array.isArray(obj.movimientos)) return null;

    var limpio = datosVacios();

    obj.categorias.forEach(function (c) {
      var nombre = String(c || "").trim();
      if (nombre && limpio.categorias.indexOf(nombre) === -1) limpio.categorias.push(nombre);
    });

    obj.productos.forEach(function (p) {
      if (!p || !String(p.codigo || "").trim() || !String(p.nombre || "").trim()) return;
      limpio.productos.push({
        codigo: String(p.codigo).trim(),
        nombre: String(p.nombre).trim(),
        categoria: String(p.categoria || "").trim(),
        unidad: String(p.unidad || "unidad"),
        precio: numero(p.precio),
        stockInicial: numero(p.stockInicial),
        stock: numero(p.stock),
        stockMinimo: numero(p.stockMinimo)
      });
    });

    obj.movimientos.forEach(function (m) {
      if (!m || (m.tipo !== "entrada" && m.tipo !== "salida")) return;
      limpio.movimientos.push({
        id: m.id || Date.now() + Math.random(),
        fecha: String(m.fecha || ""),
        codigo: String(m.codigo || ""),
        nombre: String(m.nombre || ""),
        tipo: m.tipo,
        motivo: String(m.motivo || ""),
        cantidad: numero(m.cantidad),
        observacion: String(m.observacion || "")
      });
    });

    return limpio;
  }

  /* 2. UTILIDADES ------------------------------------------- */
  function $(id) { return document.getElementById(id); }

  function numero(valor) {
    var n = parseFloat(valor);
    return isFinite(n) ? redondear(n) : 0;
  }

  function redondear(n) { return Math.round(n * 1000) / 1000; }

  var formatoNumero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });
  var formatoPrecio = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function fechaLinda(iso) {
    var partes = String(iso).split("-");
    return partes.length === 3 ? partes[2] + "/" + partes[1] + "/" + partes[0] : iso;
  }

  // Crea un elemento; el texto siempre va con textContent (más seguro).
  function crear(etiqueta, opciones) {
    var e = document.createElement(etiqueta);
    opciones = opciones || {};
    if (opciones.clase) e.className = opciones.clase;
    if (opciones.texto !== undefined) e.textContent = opciones.texto;
    if (opciones.tipo) e.type = opciones.tipo;
    if (opciones.datos) {
      Object.keys(opciones.datos).forEach(function (k) { e.dataset[k] = opciones.datos[k]; });
    }
    return e;
  }

  function celda(texto, clase) {
    return crear("td", { texto: texto, clase: clase });
  }

  function buscarProducto(codigo) {
    var buscado = String(codigo).trim().toLowerCase();
    for (var i = 0; i < datos.productos.length; i++) {
      if (datos.productos[i].codigo.toLowerCase() === buscado) return datos.productos[i];
    }
    return null;
  }

  var ESTADOS = {
    "ok": "Normal",
    "bajo": "Bajo el mínimo",
    "sin-stock": "Sin stock"
  };

  function estadoDe(p) {
    if (p.stock <= 0) return "sin-stock";
    if (p.stock <= p.stockMinimo) return "bajo";
    return "ok";
  }

  function insigniaEstado(estado) {
    return crear("span", { clase: "estado estado-" + estado, texto: ESTADOS[estado] });
  }

  /* 3. AVISOS ------------------------------------------------ */
  var avisoEl = crear("div", { clase: "aviso" });
  avisoEl.setAttribute("role", "status");
  avisoEl.hidden = true;
  document.body.appendChild(avisoEl);
  var temporizadorAviso = null;

  function avisar(texto, esError, milisegundos) {
    avisoEl.textContent = texto;
    avisoEl.className = "aviso" + (esError ? " aviso-error" : "");
    avisoEl.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { avisoEl.hidden = true; }, milisegundos || 3500);
  }

  // Cartel fijo arriba cuando no hay internet
  var sinConexionEl = crear("div", { clase: "aviso-conexion", texto: "📡 Sin conexión: tus datos se siguen guardando en este celular" });
  sinConexionEl.hidden = navigator.onLine;
  document.body.insertBefore(sinConexionEl, document.body.firstChild);
  window.addEventListener("online", function () { sinConexionEl.hidden = true; });
  window.addEventListener("offline", function () { sinConexionEl.hidden = false; });

  /* 4. MENÚ: una sola pantalla a la vez ---------------------- */
  var botonesMenu = document.querySelectorAll(".menu-boton");
  var vistas = document.querySelectorAll(".vista");

  function mostrarVista(nombre) {
    vistas.forEach(function (v) { v.hidden = v.id !== "vista-" + nombre; });
    botonesMenu.forEach(function (b) {
      var activo = b.dataset.vista === nombre;
      b.classList.toggle("activo", activo);
      if (activo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  botonesMenu.forEach(function (b) {
    b.addEventListener("click", function () { mostrarVista(b.dataset.vista); });
  });

  /* 5. CATEGORÍAS -------------------------------------------- */
  function llenarSelect(select, valores, textoInicial) {
    var actual = select.value;
    select.textContent = "";
    var primera = crear("option", { texto: textoInicial });
    primera.value = "";
    select.appendChild(primera);
    valores.forEach(function (v) {
      var o = crear("option", { texto: v });
      o.value = v;
      select.appendChild(o);
    });
    if (valores.indexOf(actual) !== -1) select.value = actual;
  }

  function ordenadas() {
    return datos.categorias.slice().sort(function (a, b) { return a.localeCompare(b, "es"); });
  }

  function renderCategorias() {
    var lista = $("lista-categorias");
    lista.textContent = "";
    ordenadas().forEach(function (nombre) {
      var usados = datos.productos.filter(function (p) { return p.categoria === nombre; }).length;
      var li = crear("li");
      var texto = crear("span", { clase: "li-texto" });
      texto.appendChild(crear("strong", { texto: nombre }));
      texto.appendChild(crear("small", { texto: usados + (usados === 1 ? " producto" : " productos") }));
      var borrar = crear("button", { texto: "Eliminar", tipo: "button", clase: "btn-chico btn-peligro", datos: { categoria: nombre } });
      li.appendChild(texto);
      li.appendChild(borrar);
      lista.appendChild(li);
    });
    llenarSelect($("prod-categoria"), ordenadas(), "Seleccionar…");
    llenarSelect($("filtro-categoria"), ordenadas(), "Todas");
  }

  $("form-categoria").addEventListener("submit", function (e) {
    e.preventDefault();
    var nombre = $("cat-nombre").value.trim();
    if (!nombre) return;
    var repetida = datos.categorias.some(function (c) { return c.toLowerCase() === nombre.toLowerCase(); });
    if (repetida) {
      avisar("Esa categoría ya existe.", true);
      return;
    }
    datos.categorias.push(nombre);
    guardarDatos();
    renderCategorias();
    e.target.reset();
    avisar("Categoría agregada ✔");
  });

  $("lista-categorias").addEventListener("click", function (e) {
    var boton = e.target.closest("button[data-categoria]");
    if (!boton) return;
    var nombre = boton.dataset.categoria;
    var enUso = datos.productos.some(function (p) { return p.categoria === nombre; });
    if (enUso) {
      avisar("No se puede eliminar: hay productos en «" + nombre + "».", true);
      return;
    }
    if (!confirm("¿Eliminar la categoría «" + nombre + "»?")) return;
    datos.categorias = datos.categorias.filter(function (c) { return c !== nombre; });
    guardarDatos();
    renderCategorias();
  });

  /* 6. PRODUCTOS --------------------------------------------- */
  var formProducto = $("form-producto");

  function productosFiltrados() {
    var texto = $("buscar-producto").value.trim().toLowerCase();
    var categoria = $("filtro-categoria").value;
    var estado = $("filtro-estado").value;
    return datos.productos.filter(function (p) {
      var coincideTexto = !texto || p.codigo.toLowerCase().indexOf(texto) !== -1 || p.nombre.toLowerCase().indexOf(texto) !== -1;
      return coincideTexto && (!categoria || p.categoria === categoria) && (!estado || estadoDe(p) === estado);
    }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });
  }

  function renderProductos() {
    var cuerpo = $("cuerpo-productos");
    cuerpo.textContent = "";
    var lista = productosFiltrados();

    if (lista.length === 0) {
      var fila = crear("tr");
      var vacia = celda(datos.productos.length === 0 ? "📭 Todavía no hay productos cargados" : "🔍 No hay productos con esos filtros", "vacio");
      vacia.colSpan = 9;
      fila.appendChild(vacia);
      cuerpo.appendChild(fila);
    }

    lista.forEach(function (p) {
      var tr = crear("tr");
      tr.appendChild(celda(p.codigo));
      tr.appendChild(celda(p.nombre));
      tr.appendChild(celda(p.categoria));
      tr.appendChild(celda(p.unidad));
      tr.appendChild(celda(formatoPrecio.format(p.precio)));
      tr.appendChild(celda(formatoNumero.format(p.stock)));
      tr.appendChild(celda(formatoNumero.format(p.stockMinimo)));

      var tdEstado = crear("td");
      tdEstado.appendChild(insigniaEstado(estadoDe(p)));
      tr.appendChild(tdEstado);

      var tdAcciones = crear("td");
      var caja = crear("div", { clase: "celda-acciones" });
      caja.appendChild(crear("button", { texto: "Editar", tipo: "button", clase: "btn-chico", datos: { editar: p.codigo } }));
      caja.appendChild(crear("button", { texto: "Eliminar", tipo: "button", clase: "btn-chico btn-peligro", datos: { eliminar: p.codigo } }));
      tdAcciones.appendChild(caja);
      tr.appendChild(tdAcciones);

      cuerpo.appendChild(tr);
    });
  }

  function entrarEnEdicion(p) {
    codigoEnEdicion = p.codigo;
    $("prod-codigo").value = p.codigo;
    $("prod-codigo").readOnly = true;
    $("prod-nombre").value = p.nombre;
    $("prod-categoria").value = p.categoria;
    $("prod-unidad").value = p.unidad;
    $("prod-precio").value = p.precio;
    $("prod-stock-inicial").value = p.stockInicial;
    $("prod-stock-inicial").disabled = true; // el stock cambia con movimientos
    $("prod-stock-minimo").value = p.stockMinimo;
    $("btn-guardar-producto").textContent = "Guardar cambios";
    formProducto.scrollIntoView({ behavior: "smooth", block: "start" });
    $("prod-nombre").focus();
  }

  function salirDeEdicion() {
    codigoEnEdicion = null;
    $("prod-codigo").readOnly = false;
    $("prod-stock-inicial").disabled = false;
    $("btn-guardar-producto").textContent = "Guardar producto";
  }

  formProducto.addEventListener("reset", function () {
    // El navegador limpia los campos solo; nosotros salimos del modo edición.
    setTimeout(salirDeEdicion, 0);
  });

  formProducto.addEventListener("submit", function (e) {
    e.preventDefault();
    var codigo = $("prod-codigo").value.trim();
    var nombre = $("prod-nombre").value.trim();
    var categoria = $("prod-categoria").value;
    var unidad = $("prod-unidad").value;
    var precio = numero($("prod-precio").value);
    var stockMinimo = numero($("prod-stock-minimo").value);

    if (!codigo || !nombre || !categoria || !unidad) {
      avisar("Completá todos los campos.", true);
      return;
    }
    if (precio < 0 || stockMinimo < 0) {
      avisar("Los números no pueden ser negativos.", true);
      return;
    }

    if (codigoEnEdicion !== null) {
      var existente = buscarProducto(codigoEnEdicion);
      if (existente) {
        existente.nombre = nombre;
        existente.categoria = categoria;
        existente.unidad = unidad;
        existente.precio = precio;
        existente.stockMinimo = stockMinimo;
      }
      guardarDatos();
      formProducto.reset();
      renderTodo();
      avisar("Producto actualizado ✔");
      return;
    }

    if (buscarProducto(codigo)) {
      avisar("Ya existe un producto con el código " + codigo + ".", true);
      return;
    }
    var stockInicial = numero($("prod-stock-inicial").value);
    if (stockInicial < 0) {
      avisar("El stock inicial no puede ser negativo.", true);
      return;
    }

    datos.productos.push({
      codigo: codigo,
      nombre: nombre,
      categoria: categoria,
      unidad: unidad,
      precio: precio,
      stockInicial: stockInicial,
      stock: stockInicial,
      stockMinimo: stockMinimo
    });

    if (stockInicial > 0) {
      datos.movimientos.push({
        id: Date.now() + Math.random(),
        fecha: hoyISO(),
        codigo: codigo,
        nombre: nombre,
        tipo: "entrada",
        motivo: "Stock inicial",
        cantidad: stockInicial,
        observacion: ""
      });
    }

    guardarDatos();
    formProducto.reset();
    renderTodo();
    avisar("Producto guardado ✔");
  });

  $("cuerpo-productos").addEventListener("click", function (e) {
    var botonEditar = e.target.closest("button[data-editar]");
    var botonEliminar = e.target.closest("button[data-eliminar]");
    if (botonEditar) {
      var p = buscarProducto(botonEditar.dataset.editar);
      if (p) entrarEnEdicion(p);
    } else if (botonEliminar) {
      var codigo = botonEliminar.dataset.eliminar;
      var prod = buscarProducto(codigo);
      if (!prod) return;
      if (!confirm("¿Eliminar «" + prod.nombre + "»? El historial de movimientos se conserva.")) return;
      datos.productos = datos.productos.filter(function (x) { return x.codigo !== prod.codigo; });
      if (codigoEnEdicion === prod.codigo) formProducto.reset();
      guardarDatos();
      renderTodo();
    }
  });

  ["input", "change"].forEach(function (evento) {
    $("buscar-producto").addEventListener(evento, renderProductos);
    $("filtro-categoria").addEventListener(evento, renderProductos);
    $("filtro-estado").addEventListener(evento, renderProductos);
  });

  /* 7. MOVIMIENTOS ------------------------------------------- */
  var formMovimiento = $("form-movimiento");

  function renderCodigos() {
    var lista = $("lista-codigos");
    lista.textContent = "";
    datos.productos.forEach(function (p) {
      var o = crear("option", { texto: p.nombre });
      o.value = p.codigo;
      lista.appendChild(o);
    });
  }

  function renderMovimientos() {
    var cuerpo = $("cuerpo-movimientos");
    cuerpo.textContent = "";

    if (datos.movimientos.length === 0) {
      var fila = crear("tr");
      var vacia = celda("📭 Todavía no hay movimientos", "vacio");
      vacia.colSpan = 7;
      fila.appendChild(vacia);
      cuerpo.appendChild(fila);
      return;
    }

    // Los más nuevos primero (se agregan al final del arreglo)
    var ordenados = datos.movimientos.map(function (m, i) { return { m: m, i: i }; });
    ordenados.sort(function (a, b) {
      if (a.m.fecha !== b.m.fecha) return a.m.fecha < b.m.fecha ? 1 : -1;
      return b.i - a.i;
    });

    ordenados.forEach(function (item) {
      var m = item.m;
      var tr = crear("tr");
      tr.appendChild(celda(fechaLinda(m.fecha)));
      tr.appendChild(celda(m.codigo));
      tr.appendChild(celda(m.nombre));
      tr.appendChild(celda(m.tipo === "entrada" ? "Entrada" : "Salida", "tipo-" + m.tipo));
      tr.appendChild(celda(m.motivo));
      tr.appendChild(celda(formatoNumero.format(m.cantidad)));
      tr.appendChild(celda(m.observacion));
      cuerpo.appendChild(tr);
    });
  }

  formMovimiento.addEventListener("reset", function () {
    setTimeout(function () { $("mov-fecha").value = hoyISO(); }, 0);
  });

  formMovimiento.addEventListener("submit", function (e) {
    e.preventDefault();
    var producto = buscarProducto($("mov-codigo").value);
    var tipo = $("mov-tipo").value;
    var motivo = $("mov-motivo").value.trim();
    var cantidad = numero($("mov-cantidad").value);
    var fecha = $("mov-fecha").value;
    var observacion = $("mov-observacion").value.trim();

    if (!producto) {
      avisar("Ese código no corresponde a ningún producto.", true);
      $("mov-codigo").focus();
      return;
    }
    if (tipo !== "entrada" && tipo !== "salida") {
      avisar("Elegí si es entrada o salida.", true);
      return;
    }
    if (!motivo || !fecha) {
      avisar("Completá el motivo y la fecha.", true);
      return;
    }
    if (cantidad <= 0) {
      avisar("La cantidad tiene que ser mayor que cero.", true);
      return;
    }
    if (tipo === "salida" && cantidad > producto.stock) {
      avisar("Stock insuficiente: hay " + formatoNumero.format(producto.stock) + " " + producto.unidad + ".", true);
      return;
    }

    producto.stock = redondear(producto.stock + (tipo === "entrada" ? cantidad : -cantidad));
    datos.movimientos.push({
      id: Date.now() + Math.random(),
      fecha: fecha,
      codigo: producto.codigo,
      nombre: producto.nombre,
      tipo: tipo,
      motivo: motivo,
      cantidad: cantidad,
      observacion: observacion
    });

    guardarDatos();
    formMovimiento.reset();
    renderTodo();

    var estado = estadoDe(producto);
    if (estado !== "ok") {
      avisar("Movimiento registrado. ⚠️ " + producto.nombre + ": " + ESTADOS[estado].toLowerCase() + ".", false, 5000);
    } else {
      avisar("Movimiento registrado ✔");
    }
  });

  /* 8. ALERTAS ----------------------------------------------- */
  function renderAlertas() {
    var lista = $("lista-alertas");
    lista.textContent = "";

    var enAlerta = datos.productos.filter(function (p) { return estadoDe(p) !== "ok"; });
    enAlerta.sort(function (a, b) {
      var pa = estadoDe(a) === "sin-stock" ? 0 : 1;
      var pb = estadoDe(b) === "sin-stock" ? 0 : 1;
      return pa - pb || a.nombre.localeCompare(b.nombre, "es");
    });

    enAlerta.forEach(function (p) {
      var estado = estadoDe(p);
      var li = crear("li", { clase: estado === "sin-stock" ? "sin-stock" : "" });
      var texto = crear("span", { clase: "li-texto" });
      texto.appendChild(crear("strong", { texto: p.nombre }));
      texto.appendChild(crear("small", {
        texto: "Código " + p.codigo + " · Stock " + formatoNumero.format(p.stock) + " " + p.unidad +
               " · Mínimo " + formatoNumero.format(p.stockMinimo)
      }));
      li.appendChild(texto);
      li.appendChild(insigniaEstado(estado));
      lista.appendChild(li);
    });

    var contador = $("contador-alertas");
    contador.textContent = enAlerta.length;
    contador.classList.toggle("vacio", enAlerta.length === 0);
  }

  /* 9. EXPORTAR E IMPORTAR ----------------------------------- */
  $("btn-exportar").addEventListener("click", function () {
    var contenido = JSON.stringify({
      app: "Súper Barrio",
      version: 1,
      exportado: new Date().toISOString(),
      categorias: datos.categorias,
      productos: datos.productos,
      movimientos: datos.movimientos
    }, null, 2);
    var nombre = "super-barrio-" + hoyISO() + ".json";
    var archivo = new File([contenido], nombre, { type: "application/json" });

    // En el celular: compartir (WhatsApp, correo, Drive). Si no se puede, descargar.
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: "Datos de Súper Barrio" }).catch(function (err) {
        if (err && err.name !== "AbortError") descargar(archivo);
      });
    } else {
      descargar(archivo);
    }
  });

  function descargar(archivo) {
    var url = URL.createObjectURL(archivo);
    var a = document.createElement("a");
    a.href = url;
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    avisar("Archivo exportado ✔");
  }

  $("input-importar").addEventListener("change", function (e) {
    var archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    var lector = new FileReader();
    lector.onload = function () {
      var nuevos = null;
      try {
        nuevos = normalizar(JSON.parse(lector.result));
      } catch (err) {
        nuevos = null;
      }
      if (!nuevos) {
        avisar("El archivo no es válido para esta app.", true);
        return;
      }
      var resumen = nuevos.productos.length + " productos, " + nuevos.movimientos.length + " movimientos";
      if (!confirm("Importar " + resumen + ".\nEsto reemplaza los datos actuales de este dispositivo. ¿Seguir?")) return;
      datos = nuevos;
      formProducto.reset();
      guardarDatos();
      renderTodo();
      avisar("Datos importados ✔");
    };
    lector.onerror = function () { avisar("No se pudo leer el archivo.", true); };
    lector.readAsText(archivo);
  });

  /* 10. DIBUJAR TODO ----------------------------------------- */
  function renderTodo() {
    renderCategorias();
    renderCodigos();
    renderProductos();
    renderMovimientos();
    renderAlertas();
  }

  /* 11. INICIO ----------------------------------------------- */
  $("mov-fecha").value = hoyISO();
  guardarDatos(); // deja guardadas las categorías iniciales la primera vez
  renderTodo();
  mostrarVista("productos");

  /* 12. PWA: service worker ---------------------------------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").then(function (registro) {
        registro.addEventListener("updatefound", function () {
          var nuevo = registro.installing;
          if (!nuevo) return;
          nuevo.addEventListener("statechange", function () {
            // Si ya había un service worker, esto es una actualización
            if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
              avisar("Hay una versión nueva: cerrá y volvé a abrir la app", false, 10000);
            }
          });
        });
      }).catch(function () {
        // En file:// no se puede registrar: la app igual funciona.
      });
    });
  }

})();
