// js/main.js (Versión con Sesión Persistente)

// 1. IMPORTACIONES (Sin cambios)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    addDoc, 
    collection,
    query,
    onSnapshot,
    updateDoc,
    getDoc,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuración de Firebase --- (Sin cambios)
const firebaseConfig = {
  apiKey: "AIzaSyA4voqljOivBk0YwS-llbGEfIeBuYkh5gI",
  authDomain: "felpa-store.firebaseapp.com",
  projectId: "felpa-store",
  storageBucket: "felpa-store.firebasestorage.app",
  messagingSenderId: "971773708207",
  appId: "1:971773708207:web:d4a318825ca45691a9515a",
  measurementId: "G-T642N5NBE2"
};

// --- Inicialización ---
const appId = firebaseConfig.appId;
const initialAuthToken = null; 

let app, auth, db;
let adminListenerUnsubscribe = null; 
let adminPedidosListenerUnsubscribe = null; 
let localCart = []; 
let currentTotal = 0; 

try {
    app = initializeApp(firebaseConfig); 
    auth = getAuth(app);
    db = getFirestore(app);
    setLogLevel('Debug');
    console.log("Firebase inicializado correctamente con tus claves.");

    // ===============================================================
    // CAMBIO 1: ELIMINAMOS EL INICIO DE SESIÓN ANÓNIMO DE AQUÍ
    // (Esto era lo que "cerraba tu sesión" de admin al recargar)
    // await signInAnonymously(auth); // <-- LÍNEA ELIMINADA
    // ===============================================================

} catch (error) {
    console.error("Error al inicializar Firebase:", error);
    showMessage("Error al conectar con la base de datos: " + error.message);
}


// --- Selectores de Elementos --- (Sin cambios)
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const customPlushBtn = document.getElementById('customPlushBtn');
const homeBtn = document.getElementById('homeBtn');
const cartIcon = document.getElementById('cartIcon');
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const customPlushModal = document.getElementById('customPlushModal');
const cartModal = document.getElementById('cartModal');
const authLinks = document.getElementById('authLinks');
const userLinks = document.getElementById('userLinks');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const mainContent = document.getElementById('mainContent');
const adminSection = document.getElementById('adminSection');
const pedidosContainer = document.getElementById('pedidosContainer');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartTotal = document.getElementById('cartTotal');
const cartCount = document.getElementById('cartCount');
const checkoutBtn = document.getElementById('checkoutBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const customPlushForm = document.getElementById('customPlushForm');
const closeButtons = document.querySelectorAll('.close-modal-btn');
const productGrid = document.getElementById('product-grid');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const paymentModal = document.getElementById('paymentModal');
const paymentTotal = document.getElementById('paymentTotal');
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const pedidosClientesContainer = document.getElementById('pedidosClientesContainer');

// --- Función para mostrar mensajes --- (Sin cambios)
function showMessage(msg, isError = true) {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    messageText.textContent = msg;
    messageBox.className = `fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-lg ${isError ? 'bg-red-600' : 'bg-green-600'} text-white`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

// --- Lógica para Abrir/Cerrar Modales --- (Sin cambios)
function openModal(modal) { if (modal) modal.classList.remove('hidden'); }
function closeModal(modal) { if (modal) modal.classList.add('hidden'); }
loginBtn.addEventListener('click', () => openModal(loginModal));
registerBtn.addEventListener('click', () => openModal(registerModal));
cartIcon.addEventListener('click', () => openModal(cartModal));
customPlushBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(customPlushModal); });
closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(loginModal);
        closeModal(registerModal);
        closeModal(customPlushModal);
        closeModal(cartModal);
        closeModal(paymentModal);
    });
});

// --- Lógica de Navegación (Pestañas) --- (Sin cambios)
homeBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainContent.classList.remove('hidden'); 
    adminSection.classList.add('hidden'); 
    if (currentPage !== 1) {
        currentPage = 1;
        renderProducts();
        updatePaginationControls();
    }
});
adminPanelBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainContent.classList.add('hidden'); 
    adminSection.classList.remove('hidden'); 
});


// ===============================================================
// CAMBIO 2: LÓGICA DE AUTENTICACIÓN MEJORADA
// Esta función ahora maneja 3 estados:
// 1. Usuario Registrado (Admin)
// 2. Usuario Anónimo (Visitante)
// 3. Nadie (null) -> (Crea una sesión anónima)
// ===============================================================
onAuthStateChanged(auth, async (user) => {
    if (adminListenerUnsubscribe) { adminListenerUnsubscribe(); adminListenerUnsubscribe = null; }
    if (adminPedidosListenerUnsubscribe) { adminPedidosListenerUnsubscribe(); adminPedidosListenerUnsubscribe = null; }

    if (user && !user.isAnonymous) {
        // --- ESTADO 1: Usuario Registrado (Admin) ---
        // La sesión persistió. Mostramos el panel de admin.
        authLinks.classList.add('hidden');
        userLinks.classList.remove('hidden');
        userEmail.textContent = user.email;

        if (user.email === 'felpastore@tienda.com') {
            adminPanelBtn.classList.remove('hidden');
            setupAdminPanel();
        }
        
        await loadCartFromFirestore(user.uid);

    } else if (user && user.isAnonymous) {
        // --- ESTADO 2: Usuario Anónimo ---
        // Visitante normal. Mostramos login/registro.
        authLinks.classList.remove('hidden');
        userLinks.classList.add('hidden');
        userEmail.textContent = '';
        adminPanelBtn.classList.add('hidden');
        mainContent.classList.remove('hidden');
        adminSection.classList.add('hidden');
        
        // Cargamos su carrito anónimo
        await loadCartFromFirestore(user.uid);

    } else if (!user) {
        // --- ESTADO 3: Nadie (null) ---
        // Esto pasa al recargar por primera vez o al hacer signOut.
        // Creamos una sesión anónima nueva.
        try {
            await signInAnonymously(auth);
            // onAuthStateChanged se volverá a ejecutar,
            // y caerá en el "ESTADO 2: Usuario Anónimo"
        } catch (error) {
            console.error("Error al crear sesión anónima:", error);
            showMessage("Error al conectar con el servidor.");
        }
    }
});

// Manejar Registro (Sin cambios)
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const profileData = {
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        telefono: document.getElementById('reg-telefono').value,
        edad: document.getElementById('reg-edad').value,
        direccion: document.getElementById('reg-direccion').value,
        ciudad: document.getElementById('reg-ciudad').value,
        email: email
    };

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/profile`, 'details');
        await setDoc(userDocRef, profileData);
        closeModal(registerModal);
        showMessage("¡Cuenta creada con éxito!", false);
    } catch (error) {
        console.error("Error al registrar:", error);
        showMessage(error.message);
    }
});

// Manejar Login (Sin cambios)
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showMessage("¡Bienvenido de vuelta!", false);
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        showMessage("Email o contraseña incorrectos.");
    }
});

// ===============================================================
// CAMBIO 3: LÓGICA DE LOGOUT SIMPLIFICADA
// Ya no iniciamos sesión anónima aquí.
// onAuthStateChanged se encargará solo.
// ===============================================================
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // await signInAnonymously(auth); // <-- LÍNEA ELIMINADA
        showMessage("Has cerrado sesión.", false);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showMessage(error.message);
    }
});

// Manejar Petición de Peluche Personalizado (Sin cambios)
customPlushForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) { // Simplificado: si no hay usuario, no se puede.
        showMessage("Error inesperado. Refresca la página.");
        return;
    }
    if (user.isAnonymous) {
        showMessage("Debes iniciar sesión para enviar una petición.");
        openModal(loginModal);
        return;
    }
    const description = document.getElementById('custom-description').value;
    try {
        const peticionesRef = collection(db, `/artifacts/${appId}/public/data/peticiones`);
        await addDoc(peticionesRef, {
            userId: user.uid,
            userEmail: user.email,
            descripcion: description,
            fecha: new Date().toISOString(),
            estado: 'pendiente'
        });
        closeModal(customPlushModal);
        showMessage("¡Petición enviada! Te contactaremos pronto.", false);
        document.getElementById('custom-description').value = '';
    } catch (error) {
        console.error("Error al enviar petición:", error);
        showMessage("Error al enviar la petición. Inténtalo de nuevo.");
    }
});

// --- Lógica del Panel de Administrador --- (Sin cambios)
function setupAdminPanel() {
    // 1. Listener para Peticiones
    const peticionesRef = collection(db, `/artifacts/${appId}/public/data/peticiones`);
    const qPeticiones = query(peticionesRef); 
    adminListenerUnsubscribe = onSnapshot(qPeticiones, (snapshot) => {
        pedidosContainer.innerHTML = ''; 
        if (snapshot.empty) {
            pedidosContainer.innerHTML = '<p class="text-gray-500">No hay peticiones pendientes.</p>';
            return;
        }
        
        snapshot.docs.forEach(docSnap => {
            const pedido = docSnap.data();
            const pedidoId = docSnap.id;
            const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
            const estadoColor = pedido.estado === 'pendiente' ? 'bg-yellow-400' : 'bg-green-400';
            const estadoTexto = pedido.estado === 'pendiente' ? 'Pendiente' : 'Visto';

            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md p-4";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm font-semibold text-gray-500">${pedido.userEmail}</p>
                        <p class="text-gray-800 mt-2">${pedido.descripcion}</p>
                    </div>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}">${estadoTexto}</span>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <p class="text-xs text-gray-400">Fecha: ${fecha}</p>
                    ${pedido.estado === 'pendiente' ? 
                        `<button data-id="${pedidoId}" class="mark-as-seen-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded">
                            Marcar como Visto
                         </button>` : 
                        ''
                    }
                </div>
            `;
            pedidosContainer.appendChild(card);
        });

        document.querySelectorAll('.mark-as-seen-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const docRef = doc(db, `/artifacts/${appId}/public/data/peticiones`, id);
                try {
                    await updateDoc(docRef, { estado: 'visto' });
                    showMessage("Petición actualizada.", false);
                } catch (error) {
                    console.error("Error al actualizar estado:", error);
                    showMessage("Error al actualizar la petición.");
                }
            });
        });

    }, (error) => {
        console.error("Error al leer peticiones:", error);
        pedidosContainer.innerHTML = '<p class="text-red-500">Error al cargar las peticiones.</p>';
    });

    // 2. Listener para Pedidos de Clientes
    const pedidosRef = collection(db, `/artifacts/${appId}/public/data/pedidos`);
    const qPedidos = query(pedidosRef);
    
    adminPedidosListenerUnsubscribe = onSnapshot(qPedidos, (snapshot) => {
        pedidosClientesContainer.innerHTML = '';
        if (snapshot.empty) {
            pedidosClientesContainer.innerHTML = '<p class="text-gray-500">No hay pedidos de clientes.</p>';
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const pedido = docSnap.data();
            const pedidoId = docSnap.id;
            const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
            const estadoColor = pedido.estado === 'pagado' ? 'bg-yellow-400' : 'bg-green-400';
            const estadoTexto = pedido.estado === 'pagado' ? 'Pagado (Pendiente Despacho)' : 'Despachado';

            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md p-4";
            let itemsHtml = pedido.items.map(item => 
                `<li class="text-sm text-gray-700">${item.name} (x${item.quantity})</li>`
            ).join('');

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm font-semibold text-gray-500">${pedido.userEmail}</p>
                        <p class="text-xl font-bold text-purple-700 my-1">$${pedido.total.toFixed(2)}</p>
                        <ul class="list-disc list-inside mt-2">${itemsHtml}</ul>
                    </div>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}">${estadoTexto}</span>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <p class="text-xs text-gray-400">Fecha: ${fecha}</p>
                    ${pedido.estado === 'pagado' ? 
                        `<button data-id="${pedidoId}" class="mark-as-shipped-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded">
                            Marcar como Despachado
                         </button>` : 
                        ''
                    }
                </div>
            `;
            pedidosClientesContainer.appendChild(card);
        });

        document.querySelectorAll('.mark-as-shipped-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const docRef = doc(db, `/artifacts/${appId}/public/data/pedidos`, id);
                try {
                    await updateDoc(docRef, { estado: 'despachado' });
                    showMessage("Pedido actualizado a 'Despachado'.", false);
                } catch (error) {
                    console.error("Error al actualizar estado:", error);
                    showMessage("Error al actualizar el pedido.");
                }
            });
        });

    }, (error) => {
        console.error("Error al leer pedidos:", error);
        pedidosClientesContainer.innerHTML = '<p class="text-red-500">Error al cargar los pedidos.</p>';
    });
}


// --- Lógica del Carrito de Compras --- (Sin cambios)

async function loadCartFromFirestore(userId) {
    if (!userId) return;
    const cartDocRef = doc(db, `/artifacts/${appId}/users/${userId}/cart`, 'items');
    try {
        const docSnap = await getDoc(cartDocRef);
        if (docSnap.exists()) {
            localCart = docSnap.data().items || [];
        } else {
            localCart = [];
        }
    } catch (error) {
        console.error("Error al cargar el carrito:", error);
        localCart = [];
    }
    updateCartUI();
}

async function saveCartToFirestore() {
    const user = auth.currentUser;
    if (!user) return; // Si no hay usuario (raro), no hacer nada
    
    const cartDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/cart`, 'items');
    try {
        await setDoc(cartDocRef, { items: localCart });
        console.log("Carrito guardado en Firestore para UID:", user.uid);
    } catch (error) {
        console.error("Error al guardar el carrito:", error);
        showMessage("Error al guardar tu carrito.");
    }
}

function updateCartUI() {
    cartItemsContainer.innerHTML = ''; 
    currentTotal = 0;
    let totalItems = 0;

    if (localCart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Tu carrito está vacío.</p>';
        checkoutBtn.disabled = true; 
        checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    localCart.forEach(item => {
        currentTotal += item.price * item.quantity;
        totalItems += item.quantity;

        const itemElement = document.createElement('div');
        itemElement.className = "flex justify-between items-center";
        itemElement.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">${item.name}</p>
                <p class="text-sm text-gray-600">$${item.price.toFixed(2)} x ${item.quantity}</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="remove-item-btn bg-red-100 text-red-700 p-1 rounded-full w-6 h-6 flex items-center justify-center" data-id="${item.id}">-</button>
                <span class="w-5 text-center">${item.quantity}</span>
                <button class="add-item-btn bg-green-100 text-green-700 p-1 rounded-full w-6 h-6 flex items-center justify-center" data-id="${item.id}">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemElement);
    });

    cartTotal.textContent = `$${currentTotal.toFixed(2)}`;
    cartCount.textContent = totalItems;
    addCartItemListeners();
}

function addCartItemListeners() {
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            handleCartQuantityChange(id, 'decrease');
        });
    });

    document.querySelectorAll('.add-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            handleCartQuantityChange(id, 'increase');
        });
    });
}

function handleCartQuantityChange(id, action) {
    const item = localCart.find(item => item.id === id);
    if (!item) return;

    if (action === 'increase') {
        item.quantity++;
    } else if (action === 'decrease') {
        item.quantity--;
    }

    if (item.quantity <= 0) {
        localCart = localCart.filter(item => item.id !== id);
    }

    updateCartUI();
    saveCartToFirestore();
}

// --- Lógica de Pago --- (Sin cambios)

checkoutBtn.addEventListener('click', () => {
     const user = auth.currentUser;
     if (!user || user.isAnonymous) {
        showMessage("Debes iniciar sesión para proceder al pago.");
        openModal(loginModal);
        return;
     }
     
     closeModal(cartModal);
     paymentTotal.textContent = `$${currentTotal.toFixed(2)}`;
     openModal(paymentModal);
});

confirmPaymentBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || localCart.length === 0) {
        showMessage("Error: no hay usuario o el carrito está vacío.");
        return;
    }

    try {
        const pedidosRef = collection(db, `/artifacts/${appId}/public/data/pedidos`);
        await addDoc(pedidosRef, {
            userId: user.uid,
            userEmail: user.email,
            items: localCart, 
            total: currentTotal,
            fecha: new Date().toISOString(),
            estado: 'pagado'
        });

        localCart = [];
        await saveCartToFirestore();
        updateCartUI();

        closeModal(paymentModal);
        showMessage("¡Gracias por tu compra! Tu pedido está siendo procesado.", false);

    } catch (error) {
        console.error("Error al confirmar el pedido:", error);
        showMessage("Error al guardar tu pedido. Contacta a soporte.");
    }
});

// --- Lógica de Paginación y Productos --- (Sin cambios)

const allProducts = [];
const productNames = ['Oso', 'Conejo', 'Panda', 'Llama', 'Tigre', 'León', 'Elefante', 'Jirafa', 'Mono', 'Koala'];
const productColors = ['Clásico', 'Rosa', 'Azul', 'Beige', 'Gris'];
let prodId = 1;

for (const color of productColors) {
    for (const name of productNames) {
        const productName = `${name} ${color}`;
        const price = (Math.random() * 20 + 15).toFixed(2);
        allProducts.push({
            id: `prod_${String(prodId).padStart(3, '0')}`,
            name: productName,
            price: parseFloat(price)
        });
        prodId++;
    }
}

let currentPage = 1;
const productsPerPage = 10;
const totalPages = Math.ceil(allProducts.length / productsPerPage);

function renderProducts() {
    productGrid.innerHTML = ''; 
    
    const start = (currentPage - 1) * productsPerPage;
    const end = currentPage * productsPerPage;
    const productsToShow = allProducts.slice(start, end);

    productsToShow.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = "bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105";
        const placeholderImg = `https://placehold.co/400x400/E9D5FF/4C1D95?text=${product.name.replace(' ', '+')}`;
        productCard.innerHTML = `
            <img src="${placeholderImg}" alt="${product.name}" class="w-full h-48 object-cover" onerror="this.onerror=null; this.src='https://placehold.co/400x400/E9D5FF/4C1D95?text=Peluche';">
            <div class="p-4">
                <h3 class="text-lg font-semibold text-gray-800 truncate">${product.name}</h3>
                <p class="text-xl font-bold text-purple-700 mt-1">$${product.price.toFixed(2)}</p>
                <button class="add-to-cart-btn mt-3 w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                                data-id="${product.id}" data-name="${product.name}" data-price="${product.price}">
                            Agregar al carrito
                        </button>
            </div>
        `;
        productGrid.appendChild(productCard);
    });
}

function updatePaginationControls() {
    pageInfo.textContent = `Página ${currentPage} / ${totalPages}`;
    prevPageBtn.disabled = (currentPage === 1);
    nextPageBtn.disabled = (currentPage === totalPages);
}

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
        updatePaginationControls();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
        updatePaginationControls();
    }
});

productGrid.addEventListener('click', (e) => {
    if (!e.target.classList.contains('add-to-cart-btn')) {
        return;
    }

    const button = e.target;
    const user = auth.currentUser;
    if (!user) { // No debería pasar gracias a la nueva lógica
        showMessage("Por favor, refresca la página.");
        return;
    }
    
    // Ahora, los usuarios anónimos SÍ pueden añadir al carrito
    // if (user.isAnonymous) {
    //     showMessage("Debes iniciar sesión para agregar productos.");
    //     openModal(loginModal);
    //     return;
    // }

    const id = button.dataset.id;
    const name = button.dataset.name;
    const price = parseFloat(button.dataset.price);

    const existingItem = localCart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        localCart.push({ id, name, price, quantity: 1 });
    }

    showMessage("¡Producto añadido al carrito!", false);
    updateCartUI();
    saveCartToFirestore();
});


// --- Carga Inicial --- (Sin cambios)
renderProducts();
updatePaginationControls();
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    messageText.textContent = msg;
    messageBox.className = `fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-lg ${isError ? 'bg-red-600' : 'bg-green-600'} text-white`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

// --- Lógica para Abrir/Cerrar Modales ---
function openModal(modal) { if (modal) modal.classList.remove('hidden'); }
function closeModal(modal) { if (modal) modal.classList.add('hidden'); }

loginBtn.addEventListener('click', () => openModal(loginModal));
registerBtn.addEventListener('click', () => openModal(registerModal));
cartIcon.addEventListener('click', () => openModal(cartModal));
customPlushBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(customPlushModal); });

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(loginModal);
        closeModal(registerModal);
        closeModal(customPlushModal);
        closeModal(cartModal);
        closeModal(paymentModal); // Añadido modal de pago
    });
});

// --- Lógica de Navegación (Pestañas) ---
homeBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainContent.classList.remove('hidden'); 
    adminSection.classList.add('hidden'); 
    
    if (currentPage !== 1) {
        currentPage = 1;
        renderProducts();
        updatePaginationControls();
    }
});
adminPanelBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainContent.classList.add('hidden'); 
    adminSection.classList.remove('hidden'); 
});


// --- Lógica de Autenticación (Firebase) ---
onAuthStateChanged(auth, async (user) => {
    if (adminListenerUnsubscribe) { adminListenerUnsubscribe(); adminListenerUnsubscribe = null; }
    if (adminPedidosListenerUnsubscribe) { adminPedidosListenerUnsubscribe(); adminPedidosListenerUnsubscribe = null; }

    if (user && !user.isAnonymous) {
        authLinks.classList.add('hidden');
        userLinks.classList.remove('hidden');
        userEmail.textContent = user.email;

        if (user.email === 'felpastore@tienda.com') {
            adminPanelBtn.classList.remove('hidden');
            setupAdminPanel(); // Esta función ahora activa los 2 listeners
        }
        
        await loadCartFromFirestore(user.uid);

    } else {
        authLinks.classList.remove('hidden');
        userLinks.classList.add('hidden');
        userEmail.textContent = '';
        adminPanelBtn.classList.add('hidden');
        mainContent.classList.remove('hidden');
        adminSection.classList.add('hidden');
        
        localCart = [];
        updateCartUI();
    }
});

// Manejar Registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const profileData = {
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        telefono: document.getElementById('reg-telefono').value,
        edad: document.getElementById('reg-edad').value,
        direccion: document.getElementById('reg-direccion').value,
        ciudad: document.getElementById('reg-ciudad').value,
        email: email
    };

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/profile`, 'details');
        await setDoc(userDocRef, profileData);
        closeModal(registerModal);
        showMessage("¡Cuenta creada con éxito!", false);
    } catch (error) {
        console.error("Error al registrar:", error);
        showMessage(error.message);
    }
});

// Manejar Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showMessage("¡Bienvenido de vuelta!", false);
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        showMessage("Email o contraseña incorrectos.");
    }
});

// Manejar Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        await signInAnonymously(auth);
        showMessage("Has cerrado sesión.", false);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showMessage(error.message);
    }
});

// Manejar Petición de Peluche Personalizado
customPlushForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        showMessage("Debes iniciar sesión para enviar una petición.");
        openModal(loginModal);
        return;
    }
    const description = document.getElementById('custom-description').value;
    try {
        const peticionesRef = collection(db, `/artifacts/${appId}/public/data/peticiones`);
        await addDoc(peticionesRef, {
            userId: user.uid,
            userEmail: user.email,
            descripcion: description,
            fecha: new Date().toISOString(),
            estado: 'pendiente'
        });
        closeModal(customPlushModal);
        showMessage("¡Petición enviada! Te contactaremos pronto.", false);
        document.getElementById('custom-description').value = '';
    } catch (error) {
        console.error("Error al enviar petición:", error);
        showMessage("Error al enviar la petición. Inténtalo de nuevo.");
    }
});

// --- Lógica del Panel de Administrador (ACTUALIZADA) ---
function setupAdminPanel() {
    // 1. Listener para Peticiones
    const peticionesRef = collection(db, `/artifacts/${appId}/public/data/peticiones`);
    const qPeticiones = query(peticionesRef); 
    adminListenerUnsubscribe = onSnapshot(qPeticiones, (snapshot) => {
        pedidosContainer.innerHTML = ''; 
        if (snapshot.empty) {
            pedidosContainer.innerHTML = '<p class="text-gray-500">No hay peticiones pendientes.</p>';
            return;
        }
        
        snapshot.docs.forEach(docSnap => {
            const pedido = docSnap.data();
            const pedidoId = docSnap.id;
            const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
            const estadoColor = pedido.estado === 'pendiente' ? 'bg-yellow-400' : 'bg-green-400';
            const estadoTexto = pedido.estado === 'pendiente' ? 'Pendiente' : 'Visto';

            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md p-4";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm font-semibold text-gray-500">${pedido.userEmail}</p>
                        <p class="text-gray-800 mt-2">${pedido.descripcion}</p>
                    </div>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}">${estadoTexto}</span>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <p class="text-xs text-gray-400">Fecha: ${fecha}</p>
                    ${pedido.estado === 'pendiente' ? 
                        `<button data-id="${pedidoId}" class="mark-as-seen-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded">
                            Marcar como Visto
                         </button>` : 
                        ''
                    }
                </div>
            `;
            pedidosContainer.appendChild(card);
        });

        document.querySelectorAll('.mark-as-seen-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const docRef = doc(db, `/artifacts/${appId}/public/data/peticiones`, id);
                try {
                    await updateDoc(docRef, { estado: 'visto' });
                    showMessage("Petición actualizada.", false);
                } catch (error) {
                    console.error("Error al actualizar estado:", error);
                    showMessage("Error al actualizar la petición.");
                }
            });
        });

    }, (error) => {
        console.error("Error al leer peticiones:", error);
        pedidosContainer.innerHTML = '<p class="text-red-500">Error al cargar las peticiones.</p>';
    });

    // 2. NUEVO Listener para Pedidos de Clientes
    const pedidosRef = collection(db, `/artifacts/${appId}/public/data/pedidos`);
    const qPedidos = query(pedidosRef);
    
    adminPedidosListenerUnsubscribe = onSnapshot(qPedidos, (snapshot) => {
        pedidosClientesContainer.innerHTML = '';
        if (snapshot.empty) {
            pedidosClientesContainer.innerHTML = '<p class="text-gray-500">No hay pedidos de clientes.</p>';
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const pedido = docSnap.data();
            const pedidoId = docSnap.id;
            const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
            const estadoColor = pedido.estado === 'pagado' ? 'bg-yellow-400' : 'bg-green-400';
            const estadoTexto = pedido.estado === 'pagado' ? 'Pagado (Pendiente Despacho)' : 'Despachado';

            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md p-4";
            let itemsHtml = pedido.items.map(item => 
                `<li class="text-sm text-gray-700">${item.name} (x${item.quantity})</li>`
            ).join('');

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm font-semibold text-gray-500">${pedido.userEmail}</p>
                        <p class="text-xl font-bold text-purple-700 my-1">$${pedido.total.toFixed(2)}</p>
                        <ul class="list-disc list-inside mt-2">${itemsHtml}</ul>
                    </div>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}">${estadoTexto}</span>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <p class="text-xs text-gray-400">Fecha: ${fecha}</p>
                    ${pedido.estado === 'pagado' ? 
                        `<button data-id="${pedidoId}" class="mark-as-shipped-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded">
                            Marcar como Despachado
                         </button>` : 
                        ''
                    }
                </div>
            `;
            pedidosClientesContainer.appendChild(card);
        });

        document.querySelectorAll('.mark-as-shipped-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const docRef = doc(db, `/artifacts/${appId}/public/data/pedidos`, id);
                try {
                    await updateDoc(docRef, { estado: 'despachado' });
                    showMessage("Pedido actualizado a 'Despachado'.", false);
                } catch (error) {
                    console.error("Error al actualizar estado:", error);
                    showMessage("Error al actualizar el pedido.");
                }
            });
        });

    }, (error) => {
        console.error("Error al leer pedidos:", error);
        pedidosClientesContainer.innerHTML = '<p class="text-red-500">Error al cargar los pedidos.</p>';
    });
}


// --- Lógica del Carrito de Compras ---

async function loadCartFromFirestore(userId) {
    if (!userId) return;
    const cartDocRef = doc(db, `/artifacts/${appId}/users/${userId}/cart`, 'items');
    try {
        const docSnap = await getDoc(cartDocRef);
        if (docSnap.exists()) {
            localCart = docSnap.data().items || [];
        } else {
            localCart = [];
        }
    } catch (error) {
        console.error("Error al cargar el carrito:", error);
        localCart = [];
    }
    updateCartUI();
}

async function saveCartToFirestore() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return; 
    
    const cartDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/cart`, 'items');
    try {
        await setDoc(cartDocRef, { items: localCart });
        console.log("Carrito guardado en Firestore.");
    } catch (error) {
        console.error("Error al guardar el carrito:", error);
        showMessage("Error al guardar tu carrito.");
    }
}

function updateCartUI() {
    cartItemsContainer.innerHTML = ''; 
    currentTotal = 0; // Resetear total
    let totalItems = 0;

    if (localCart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Tu carrito está vacío.</p>';
        checkoutBtn.disabled = true; 
        checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    localCart.forEach(item => {
        currentTotal += item.price * item.quantity;
        totalItems += item.quantity;

        const itemElement = document.createElement('div');
        itemElement.className = "flex justify-between items-center";
        itemElement.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">${item.name}</p>
                <p class="text-sm text-gray-600">$${item.price.toFixed(2)} x ${item.quantity}</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="remove-item-btn bg-red-100 text-red-700 p-1 rounded-full w-6 h-6 flex items-center justify-center" data-id="${item.id}">-</button>
                <span class="w-5 text-center">${item.quantity}</span>
                <button class="add-item-btn bg-green-100 text-green-700 p-1 rounded-full w-6 h-6 flex items-center justify-center" data-id="${item.id}">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemElement);
    });

    cartTotal.textContent = `$${currentTotal.toFixed(2)}`;
    cartCount.textContent = totalItems;
    addCartItemListeners();
}

function addCartItemListeners() {
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            handleCartQuantityChange(id, 'decrease');
        });
    });

    document.querySelectorAll('.add-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            handleCartQuantityChange(id, 'increase');
        });
    });
}

function handleCartQuantityChange(id, action) {
    const item = localCart.find(item => item.id === id);
    if (!item) return;

    if (action === 'increase') {
        item.quantity++;
    } else if (action === 'decrease') {
        item.quantity--;
    }

    if (item.quantity <= 0) {
        localCart = localCart.filter(item => item.id !== id);
    }

    updateCartUI();
    saveCartToFirestore();
}

// --- Lógica de Pago (ACTUALIZADA) ---

checkoutBtn.addEventListener('click', () => {
     // 1. Cerrar carrito
     closeModal(cartModal);
     
     // 2. Actualizar y abrir modal de pago
     paymentTotal.textContent = `$${currentTotal.toFixed(2)}`;
     openModal(paymentModal);
});

// NUEVO Listener para confirmar pago
confirmPaymentBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || localCart.length === 0) {
        showMessage("Error: no hay usuario o el carrito está vacío.");
        return;
    }

    try {
        // 1. Guardar el pedido en la base de datos pública
        const pedidosRef = collection(db, `/artifacts/${appId}/public/data/pedidos`);
        await addDoc(pedidosRef, {
            userId: user.uid,
            userEmail: user.email,
            items: localCart, // Copia del carrito
            total: currentTotal,
            fecha: new Date().toISOString(),
            estado: 'pagado' // El admin debe verificar esto
        });

        // 2. Limpiar el carrito local
        localCart = [];
        
        // 3. Guardar el carrito vacío en la base de datos del usuario
        await saveCartToFirestore();
        
        // 4. Actualizar la UI del carrito
        updateCartUI();

        // 5. Cerrar modal de pago y mostrar éxito
        closeModal(paymentModal);
        showMessage("¡Gracias por tu compra! Tu pedido está siendo procesado.", false);

    } catch (error) {
        console.error("Error al confirmar el pedido:", error);
        showMessage("Error al guardar tu pedido. Contacta a soporte.");
    }
});

// --- Lógica de Paginación y Productos ---

const allProducts = [];
const productNames = ['Oso', 'Conejo', 'Panda', 'Llama', 'Tigre', 'León', 'Elefante', 'Jirafa', 'Mono', 'Koala'];
const productColors = ['Clásico', 'Rosa', 'Azul', 'Beige', 'Gris'];
let prodId = 1;

for (const color of productColors) {
    for (const name of productNames) {
        const productName = `${name} ${color}`;
        const price = (Math.random() * 20 + 15).toFixed(2);
        allProducts.push({
            id: `prod_${String(prodId).padStart(3, '0')}`,
            name: productName,
            price: parseFloat(price)
        });
        prodId++;
    }
}

let currentPage = 1;
const productsPerPage = 10;
const totalPages = Math.ceil(allProducts.length / productsPerPage);

function renderProducts() {
    productGrid.innerHTML = ''; 
    
    const start = (currentPage - 1) * productsPerPage;
    const end = currentPage * productsPerPage;
    const productsToShow = allProducts.slice(start, end);

    productsToShow.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = "bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105";
        // Añadimos una imagen de placeholder
        const placeholderImg = `https://placehold.co/400x400/E9D5FF/4C1D95?text=${product.name.replace(' ', '+')}`;
        productCard.innerHTML = `
            <img src="${placeholderImg}" alt="${product.name}" class="w-full h-48 object-cover" onerror="this.onerror=null; this.src='https://placehold.co/400x400/E9D5FF/4C1D95?text=Peluche';">
            <div class="p-4">
                <h3 class="text-lg font-semibold text-gray-800 truncate">${product.name}</h3>
                <p class="text-xl font-bold text-purple-700 mt-1">$${product.price.toFixed(2)}</p>
                <button class="add-to-cart-btn mt-3 w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                                data-id="${product.id}" data-name="${product.name}" data-price="${product.price}">
                            Agregar al carrito
                        </button>
            </div>
        `;
        productGrid.appendChild(productCard);
    });
}

function updatePaginationControls() {
    pageInfo.textContent = `Página ${currentPage} / ${totalPages}`;
    prevPageBtn.disabled = (currentPage === 1);
    nextPageBtn.disabled = (currentPage === totalPages);
}

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
        updatePaginationControls();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
        updatePaginationControls();
    }
});

// Lógica "Agregar al Carrito" (con delegación de eventos)
productGrid.addEventListener('click', (e) => {
    if (!e.target.classList.contains('add-to-cart-btn')) {
        return;
    }

    const button = e.target;
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        showMessage("Debes iniciar sesión para agregar productos.");
        openModal(loginModal);
        return;
    }

    const id = button.dataset.id;
    const name = button.dataset.name;
    const price = parseFloat(button.dataset.price);

    const existingItem = localCart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        localCart.push({ id, name, price, quantity: 1 });
    }

    showMessage("¡Producto añadido al carrito!", false);
    updateCartUI();
    saveCartToFirestore();
});


// --- Carga Inicial ---
renderProducts(); // Renderizar Página 1
updatePaginationControls(); // Configurar botones de paginación
// --- Función para mostrar mensajes ---
function showMessage(msg, isError = true) {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    messageText.textContent = msg;
    messageBox.className = `fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-lg ${isError ? 'bg-red-600' : 'bg-green-600'} text-white`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

// --- Lógica para Abrir/Cerrar Modales ---
function openModal(modal) { if (modal) modal.classList.remove('hidden'); }
function closeModal(modal) { if (modal) modal.classList.add('hidden'); }

loginBtn.addEventListener('click', () => openModal(loginModal));
registerBtn.addEventListener('click', () => openModal(registerModal));
cartIcon.addEventListener('click', () => openModal(cartModal));
customPlushBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(customPlushModal); });

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(loginModal);
        closeModal(registerModal);
        closeModal(customPlushModal);
        closeModal(cartModal);
        closeModal(paymentModal); // Añadido modal de pago
    });
});

// --- Lógica de Navegación (Pestañas) ---
homeBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainContent.classList.remove('hidden'); 
    adminSection.classList.add('hidden'); 
    
    if (currentPage !== 1) {
        currentPage = 1;
        renderProducts();
        updatePaginationControls();
    }
});
adminPanelBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainContent.classList.add('hidden'); 
    adminSection.classList.remove('hidden'); 
});


// --- Lógica de Autenticación (Firebase) ---
onAuthStateChanged(auth, async (user) => {
    if (adminListenerUnsubscribe) { adminListenerUnsubscribe(); adminListenerUnsubscribe = null; }
    if (adminPedidosListenerUnsubscribe) { adminPedidosListenerUnsubscribe(); adminPedidosListenerUnsubscribe = null; }

    if (user && !user.isAnonymous) {
        authLinks.classList.add('hidden');
        userLinks.classList.remove('hidden');
        userEmail.textContent = user.email;

        if (user.email === 'felpastore@tienda.com') {
            adminPanelBtn.classList.remove('hidden');
            setupAdminPanel(); // Esta función ahora activa los 2 listeners
        }
        
        await loadCartFromFirestore(user.uid);

    } else {
        authLinks.classList.remove('hidden');
        userLinks.classList.add('hidden');
        userEmail.textContent = '';
        adminPanelBtn.classList.add('hidden');
        mainContent.classList.remove('hidden');
        adminSection.classList.add('hidden');
        
        localCart = [];
        updateCartUI();
    }
});

// Manejar Registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const profileData = {
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        telefono: document.getElementById('reg-telefono').value,
        edad: document.getElementById('reg-edad').value,
        direccion: document.getElementById('reg-direccion').value,
        ciudad: document.getElementById('reg-ciudad').value,
        email: email
    };

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/profile`, 'details');
        await setDoc(userDocRef, profileData);
        closeModal(registerModal);
        showMessage("¡Cuenta creada con éxito!", false);
    } catch (error) {
        console.error("Error al registrar:", error);
        showMessage(error.message);
    }
});

// Manejar Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showMessage("¡Bienvenido de vuelta!", false);
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        showMessage("Email o contraseña incorrectos.");
    }
});

// Manejar Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        await signInAnonymously(auth);
        showMessage("Has cerrado sesión.", false);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showMessage(error.message);
    }
});

// Manejar Petición de Peluche Personalizado
customPlushForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        showMessage("Debes iniciar sesión para enviar una petición.");
        openModal(loginModal);
        return;
    }
    const description = document.getElementById('custom-description').value;
    try {
        const peticionesRef = collection(db, `/artifacts/${appId}/public/data/peticiones`);
        await addDoc(peticionesRef, {
            userId: user.uid,
            userEmail: user.email,
            descripcion: description,
            fecha: new Date().toISOString(),
            estado: 'pendiente'
        });
        closeModal(customPlushModal);
        showMessage("¡Petición enviada! Te contactaremos pronto.", false);
        document.getElementById('custom-description').value = '';
    } catch (error) {
        console.error("Error al enviar petición:", error);
        showMessage("Error al enviar la petición. Inténtalo de nuevo.");
    }
});

// --- Lógica del Panel de Administrador (ACTUALIZADA) ---
function setupAdminPanel() {
    // 1. Listener para Peticiones
    const peticionesRef = collection(db, `/artifacts/${appId}/public/data/peticiones`);
    const qPeticiones = query(peticionesRef); 
    adminListenerUnsubscribe = onSnapshot(qPeticiones, (snapshot) => {
        pedidosContainer.innerHTML = ''; 
        if (snapshot.empty) {
            pedidosContainer.innerHTML = '<p class="text-gray-500">No hay peticiones pendientes.</p>';
            return;
        }
        
        snapshot.docs.forEach(docSnap => {
            const pedido = docSnap.data();
            const pedidoId = docSnap.id;
            const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
            const estadoColor = pedido.estado === 'pendiente' ? 'bg-yellow-400' : 'bg-green-400';
            const estadoTexto = pedido.estado === 'pendiente' ? 'Pendiente' : 'Visto';

            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md p-4";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm font-semibold text-gray-500">${pedido.userEmail}</p>
                        <p class="text-gray-800 mt-2">${pedido.descripcion}</p>
                    </div>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}">${estadoTexto}</span>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <p class="text-xs text-gray-400">Fecha: ${fecha}</p>
                    ${pedido.estado === 'pendiente' ? 
                        `<button data-id="${pedidoId}" class="mark-as-seen-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded">
                            Marcar como Visto
                         </button>` : 
                        ''
                    }
                </div>
            `;
            pedidosContainer.appendChild(card);
        });

        document.querySelectorAll('.mark-as-seen-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const docRef = doc(db, `/artifacts/${appId}/public/data/peticiones`, id);
                try {
                    await updateDoc(docRef, { estado: 'visto' });
                    showMessage("Petición actualizada.", false);
                } catch (error) {
                    console.error("Error al actualizar estado:", error);
                    showMessage("Error al actualizar la petición.");
                }
            });
        });

    }, (error) => {
        console.error("Error al leer peticiones:", error);
        pedidosContainer.innerHTML = '<p class="text-red-500">Error al cargar las peticiones.</p>';
    });

    // 2. NUEVO Listener para Pedidos de Clientes
    const pedidosRef = collection(db, `/artifacts/${appId}/public/data/pedidos`);
    const qPedidos = query(pedidosRef);
    
    adminPedidosListenerUnsubscribe = onSnapshot(qPedidos, (snapshot) => {
        pedidosClientesContainer.innerHTML = '';
        if (snapshot.empty) {
            pedidosClientesContainer.innerHTML = '<p class="text-gray-500">No hay pedidos de clientes.</p>';
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const pedido = docSnap.data();
            const pedidoId = docSnap.id;
            const fecha = new Date(pedido.fecha).toLocaleString('es-ES');
            const estadoColor = pedido.estado === 'pagado' ? 'bg-yellow-400' : 'bg-green-400';
            const estadoTexto = pedido.estado === 'pagado' ? 'Pagado (Pendiente Despacho)' : 'Despachado';

            const card = document.createElement('div');
            card.className = "bg-white border border-gray-200 rounded-lg shadow-md p-4";
            let itemsHtml = pedido.items.map(item => 
                `<li class="text-sm text-gray-700">${item.name} (x${item.quantity})</li>`
            ).join('');

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-sm font-semibold text-gray-500">${pedido.userEmail}</p>
                        <p class="text-xl font-bold text-purple-700 my-1">$${pedido.total.toFixed(2)}</p>
                        <ul class="list-disc list-inside mt-2">${itemsHtml}</ul>
                    </div>
                    <span class="text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor}">${estadoTexto}</span>
                </div>
                <div class="flex justify-between items-center mt-4">
                    <p class="text-xs text-gray-400">Fecha: ${fecha}</p>
                    ${pedido.estado === 'pagado' ? 
                        `<button data-id="${pedidoId}" class="mark-as-shipped-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded">
                            Marcar como Despachado
                         </button>` : 
                        ''
                    }
                </div>
            `;
            pedidosClientesContainer.appendChild(card);
        });

        document.querySelectorAll('.mark-as-shipped-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const docRef = doc(db, `/artifacts/${appId}/public/data/pedidos`, id);
                try {
                    await updateDoc(docRef, { estado: 'despachado' });
                    showMessage("Pedido actualizado a 'Despachado'.", false);
                } catch (error) {
                    console.error("Error al actualizar estado:", error);
                    showMessage("Error al actualizar el pedido.");
                }
            });
        });

    }, (error) => {
        console.error("Error al leer pedidos:", error);
        pedidosClientesContainer.innerHTML = '<p class="text-red-500">Error al cargar los pedidos.</p>';
    });
}


// --- Lógica del Carrito de Compras ---

async function loadCartFromFirestore(userId) {
    if (!userId) return;
    const cartDocRef = doc(db, `/artifacts/${appId}/users/${userId}/cart`, 'items');
    try {
        const docSnap = await getDoc(cartDocRef);
        if (docSnap.exists()) {
            localCart = docSnap.data().items || [];
        } else {
            localCart = [];
        }
    } catch (error) {
        console.error("Error al cargar el carrito:", error);
        localCart = [];
    }
    updateCartUI();
}

async function saveCartToFirestore() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return; 
    
    const cartDocRef = doc(db, `/artifacts/${appId}/users/${user.uid}/cart`, 'items');
    try {
        await setDoc(cartDocRef, { items: localCart });
        console.log("Carrito guardado en Firestore.");
    } catch (error) {
        console.error("Error al guardar el carrito:", error);
        showMessage("Error al guardar tu carrito.");
    }
}

function updateCartUI() {
    cartItemsContainer.innerHTML = ''; 
    currentTotal = 0; // Resetear total
    let totalItems = 0;

    if (localCart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Tu carrito está vacío.</p>';
        checkoutBtn.disabled = true; 
        checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    localCart.forEach(item => {
        currentTotal += item.price * item.quantity;
        totalItems += item.quantity;

        const itemElement = document.createElement('div');
        itemElement.className = "flex justify-between items-center";
        itemElement.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">${item.name}</p>
                <p class="text-sm text-gray-600">$${item.price.toFixed(2)} x ${item.quantity}</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="remove-item-btn bg-red-100 text-red-700 p-1 rounded-full w-6 h-6 flex items-center justify-center" data-id="${item.id}">-</button>
                <span class="w-5 text-center">${item.quantity}</span>
                <button class="add-item-btn bg-green-100 text-green-700 p-1 rounded-full w-6 h-6 flex items-center justify-center" data-id="${item.id}">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemElement);
    });

    cartTotal.textContent = `$${currentTotal.toFixed(2)}`;
    cartCount.textContent = totalItems;
    addCartItemListeners();
}

function addCartItemListeners() {
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            handleCartQuantityChange(id, 'decrease');
        });
    });

    document.querySelectorAll('.add-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            handleCartQuantityChange(id, 'increase');
        });
    });
}

function handleCartQuantityChange(id, action) {
    const item = localCart.find(item => item.id === id);
    if (!item) return;

    if (action === 'increase') {
        item.quantity++;
    } else if (action === 'decrease') {
        item.quantity--;
    }

    if (item.quantity <= 0) {
        localCart = localCart.filter(item => item.id !== id);
    }

    updateCartUI();
    saveCartToFirestore();
}

// --- Lógica de Pago (ACTUALIZADA) ---

checkoutBtn.addEventListener('click', () => {
     // 1. Cerrar carrito
     closeModal(cartModal);
     
     // 2. Actualizar y abrir modal de pago
     paymentTotal.textContent = `$${currentTotal.toFixed(2)}`;
     openModal(paymentModal);
});

// NUEVO Listener para confirmar pago
confirmPaymentBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || localCart.length === 0) {
        showMessage("Error: no hay usuario o el carrito está vacío.");
        return;
    }

    try {
        // 1. Guardar el pedido en la base de datos pública
        const pedidosRef = collection(db, `/artifacts/${appId}/public/data/pedidos`);
        await addDoc(pedidosRef, {
            userId: user.uid,
            userEmail: user.email,
            items: localCart, // Copia del carrito
            total: currentTotal,
            fecha: new Date().toISOString(),
            estado: 'pagado' // El admin debe verificar esto
        });

        // 2. Limpiar el carrito local
        localCart = [];
        
        // 3. Guardar el carrito vacío en la base de datos del usuario
        await saveCartToFirestore();
        
        // 4. Actualizar la UI del carrito
        updateCartUI();

        // 5. Cerrar modal de pago y mostrar éxito
        closeModal(paymentModal);
        showMessage("¡Gracias por tu compra! Tu pedido está siendo procesado.", false);

    } catch (error) {
        console.error("Error al confirmar el pedido:", error);
        showMessage("Error al guardar tu pedido. Contacta a soporte.");
    }
});

// --- Lógica de Paginación y Productos ---

const allProducts = [];
const productNames = ['Oso', 'Conejo', 'Panda', 'Llama', 'Tigre', 'León', 'Elefante', 'Jirafa', 'Mono', 'Koala'];
const productColors = ['Clásico', 'Rosa', 'Azul', 'Beige', 'Gris'];
let prodId = 1;

for (const color of productColors) {
    for (const name of productNames) {
        const productName = `${name} ${color}`;
        const price = (Math.random() * 20 + 15).toFixed(2);
        allProducts.push({
            id: `prod_${String(prodId).padStart(3, '0')}`,
            name: productName,
            price: parseFloat(price)
        });
        prodId++;
    }
}

let currentPage = 1;
const productsPerPage = 10;
const totalPages = Math.ceil(allProducts.length / productsPerPage);

function renderProducts() {
    productGrid.innerHTML = ''; 
    
    const start = (currentPage - 1) * productsPerPage;
    const end = currentPage * productsPerPage;
    const productsToShow = allProducts.slice(start, end);

    productsToShow.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = "bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105";
        // Añadimos una imagen de placeholder
        const placeholderImg = `https://placehold.co/400x400/E9D5FF/4C1D95?text=${product.name.replace(' ', '+')}`;
        productCard.innerHTML = `
            <img src="${placeholderImg}" alt="${product.name}" class="w-full h-48 object-cover" onerror="this.onerror=null; this.src='https://placehold.co/400x400/E9D5FF/4C1D95?text=Peluche';">
            <div class="p-4">
                <h3 class="text-lg font-semibold text-gray-800 truncate">${product.name}</h3>
                <p class="text-xl font-bold text-purple-700 mt-1">$${product.price.toFixed(2)}</p>
                <button class="add-to-cart-btn mt-3 w-full bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                        data-id="${product.id}" data-name="${product.name}" data-price="${product.price}">
                    Agregar al carrito
                </button>
            </div>
        `;
        productGrid.appendChild(productCard);
    });
}

function updatePaginationControls() {
    pageInfo.textContent = `Página ${currentPage} / ${totalPages}`;
    prevPageBtn.disabled = (currentPage === 1);
    nextPageBtn.disabled = (currentPage === totalPages);
}

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
        updatePaginationControls();
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
        updatePaginationControls();
    }
});

// Lógica "Agregar al Carrito" (con delegación de eventos)
productGrid.addEventListener('click', (e) => {
    if (!e.target.classList.contains('add-to-cart-btn')) {
        return;
    }

    const button = e.target;
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
        showMessage("Debes iniciar sesión para agregar productos.");
        openModal(loginModal);
        return;
    }

    const id = button.dataset.id;
    const name = button.dataset.name;
    const price = parseFloat(button.dataset.price);

    const existingItem = localCart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        localCart.push({ id, name, price, quantity: 1 });
    }

    showMessage("¡Producto añadido al carrito!", false);
    updateCartUI();
    saveCartToFirestore();
});


// --- Carga Inicial ---
renderProducts(); // Renderizar Página 1
updatePaginationControls(); // Configurar botones de paginación
