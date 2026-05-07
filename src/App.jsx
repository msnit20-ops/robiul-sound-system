import React, { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

const APP_NAME = "ROBIUL SOUND SYSTEM";
const ADMIN_PASSWORD = "130407";

const STORAGE_KEYS = {
  products: "robiul_products_v3",
  cart: "robiul_cart_v3",
  bookings: "robiul_bookings_v3",
  branding: "robiul_branding_v1",
};

const defaultBranding = {
  logo: "",
  signature: "",
  stamp: "",
  bkashNumber: "",
  bkashQR: "",
  newsEnabled: true,
  newsText: "স্বাগতম ROBIUL SOUND SYSTEM — সাউন্ড সিস্টেম, লাইটিং এবং ইভেন্ট সার্ভিস বুকিং চলছে। আজই বুকিং করুন!",
};

const FIREBASE_DOC = doc(db, "backup", "data");

const defaultProducts = [
  {
    id: "p1",
    name: "JBL Speaker Set",
    category: "Sound",
    price: 120,
    stock: 4,
    barcode: "100000000001",
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80",
    description: "Professional sound system for program, wedding and event.",
  },
  {
    id: "p2",
    name: "Wireless Microphone",
    category: "Audio",
    price: 40,
    stock: 10,
    barcode: "100000000002",
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80",
    description: "Clear wireless microphone for speech, stage and singing.",
  },
  {
    id: "p3",
    name: "LED Par Light",
    category: "Lighting",
    price: 35,
    stock: 12,
    barcode: "100000000003",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
    description: "Colorful LED lighting for stage and DJ party.",
  },
  {
    id: "p4",
    name: "Mixer Console",
    category: "Mixer",
    price: 80,
    stock: 3,
    barcode: "100000000004",
    image: "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?auto=format&fit=crop&w=800&q=80",
    description: "Audio mixer console for complete sound control.",
  },
];

function loadData(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function money(amount) {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function daysBetween(start, end) {
  if (!start || !end) return 1;
  const diff = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

function emptyProduct() {
  return { name: "", category: "", price: "", stock: "", barcode: "", description: "", image: "" };
}

function QRPreview({ value, small = false }) {
  const code = String(value || "000000000000");
  const cells = Array.from({ length: 121 }, (_, i) => {
    const n = code.charCodeAt(i % code.length) + i * 17;
    const row = Math.floor(i / 11);
    const col = i % 11;
    const finder =
      (row < 3 && col < 3) ||
      (row < 3 && col > 7) ||
      (row > 7 && col < 3);
    return finder || n % 3 === 0 || n % 5 === 0;
  });

  return (
    <div className="rounded-xl bg-white p-3 text-center text-slate-950">
      <div
        className={small ? "mx-auto grid h-20 w-20 grid-cols-11 gap-[2px]" : "mx-auto grid h-28 w-28 grid-cols-11 gap-[2px]"}
      >
        {cells.map((active, index) => (
          <div key={index} className={active ? "bg-slate-950" : "bg-white"} />
        ))}
      </div>
      <div className="mt-2 font-mono text-[10px] tracking-wider">{code}</div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState(() => loadData(STORAGE_KEYS.products, defaultProducts));
  const [cart, setCart] = useState(() => loadData(STORAGE_KEYS.cart, []));
  const [bookings, setBookings] = useState(() => loadData(STORAGE_KEYS.bookings, []));
  const [branding, setBranding] = useState(() => loadData(STORAGE_KEYS.branding, defaultBranding));
  const [firebaseLoaded, setFirebaseLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [toast, setToast] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [barcodeMenuOpen, setBarcodeMenuOpen] = useState(false);
  const [bkashMenuOpen, setBkashMenuOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [selectedBarcodes, setSelectedBarcodes] = useState([]);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", note: "" });
  const [editingProductId, setEditingProductId] = useState(null);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    photo: "",
    startDate: "",
    returnDate: "",
    actualReturnDate: "",
    paymentStatus: "Due",
    paymentMethod: "Cash",
    paidAmount: "",
    note: "",
    customTotal: "",
  });

  const dashboardStats = useMemo(() => {
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total || 0), 0);
    const totalPaid = bookings.reduce((sum, b) => sum + Number(b.paidAmount || 0), 0);
    const totalDue = bookings.reduce((sum, b) => sum + Number(b.dueAmount || 0), 0);
    const totalLateFee = bookings.reduce((sum, b) => sum + Number(b.lateFee || 0), 0);
    return {
      totalProducts: products.length,
      totalBookings: bookings.length,
      totalRevenue,
      totalPaid,
      totalDue,
      totalLateFee,
    };
  }, [products, bookings]);
  const [productForm, setProductForm] = useState(emptyProduct());

  useEffect(() => {
    async function loadBackup() {
      try {
        const snap = await getDoc(FIREBASE_DOC);
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.products)) setProducts(data.products);
          if (Array.isArray(data.cart)) setCart(data.cart);
          if (Array.isArray(data.bookings)) setBookings(data.bookings);
          if (data.branding) setBranding({ ...defaultBranding, ...data.branding });
          showToast("Firebase backup restored");
        } else {
          showToast("No Firebase backup found");
        }
      } catch (error) {
        console.error("Firebase load error:", error);
        showToast("Firebase load failed. Check config/rules");
      } finally {
        setFirebaseLoaded(true);
      }
    }

    loadBackup();
  }, []);

  useEffect(() => saveData(STORAGE_KEYS.products, products), [products]);
  useEffect(() => saveData(STORAGE_KEYS.cart, cart), [cart]);
  useEffect(() => saveData(STORAGE_KEYS.bookings, bookings), [bookings]);
  useEffect(() => saveData(STORAGE_KEYS.branding, branding), [branding]);

  useEffect(() => {
    async function saveBackup() {
      if (!firebaseLoaded) return;

      try {
        await setDoc(FIREBASE_DOC, {
          products,
          cart,
          bookings,
          branding,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Firebase save error:", error);
        showToast("Firebase save failed. Check rules");
      }
    }

    saveBackup();
  }, [products, cart, bookings, branding, firebaseLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const categories = useMemo(() => ["All", ...new Set(products.map((p) => p.category || "Other"))], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const text = `${p.name} ${p.category}`.toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      const matchCategory = category === "All" || p.category === category;
      return matchSearch && matchCategory;
    });
  }, [products, search, category]);

  const cartItems = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((p) => p.id === item.id);
        return product ? { ...product, quantity: item.quantity } : null;
      })
      .filter(Boolean);
  }, [cart, products]);

  const rentalDays = daysBetween(customer.startDate, customer.returnDate);
  const lateDays = customer.actualReturnDate ? Math.max(0, daysBetween(customer.returnDate, customer.actualReturnDate) - 1) : 0;
  const dailyCartRate = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = dailyCartRate * rentalDays;
  const lateFee = dailyCartRate * lateDays;
  const calculatedTotal = subtotal + lateFee;
  const total = customer.customTotal !== "" ? Number(customer.customTotal || 0) : calculatedTotal;
  const paidAmount = Number(customer.paidAmount || 0);
  const dueAmount = Math.max(0, total - paidAmount);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function showToast(message) {
    setToast(message);
  }

  function loginAdmin(e) {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      setAdminPassword("");
      showToast("Admin login successful");
    } else {
      showToast("Wrong password");
    }
  }

  function addToCart(product) {
    setCart((prev) => {
      const exist = prev.find((item) => item.id === product.id);
      if (exist) {
        if (exist.quantity >= product.stock) {
          showToast("Stock limit reached");
          return prev;
        }
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { id: product.id, quantity: 1 }];
    });
    setCartOpen(true);
    showToast("Added to cart");
  }

  function updateQty(id, change) {
    const product = products.find((p) => p.id === id);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const qty = Math.min(Math.max(item.quantity + change, 0), product?.stock || 1);
          return { ...item, quantity: qty };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((item) => item.id !== id));
    showToast("Removed from cart");
  }

  function deleteProduct(id) {
    if (!adminLoggedIn) return showToast("Admin login required");
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setCart((prev) => prev.filter((item) => item.id !== id));
    showToast("Product deleted");
  }

  function editProduct(product) {
    if (!adminLoggedIn) return showToast("Admin login required");
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      barcode: product.barcode || "",
      description: product.description,
      image: product.image,
    });
    setAdminPanelOpen(true);
    setTimeout(() => document.getElementById("admin")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function printSelectedBarcodes() {
    const items = products.filter((p) => selectedBarcodes.includes(p.id));
    if (!items.length) return showToast("Select product QR first");

    function makeQR(value) {
      const code = String(value || "000000000000");
      let rects = "";

      for (let i = 0; i < 121; i++) {
        const row = Math.floor(i / 11);
        const col = i % 11;
        const n = code.charCodeAt(i % code.length) + i * 17;
        const finder =
          (row < 3 && col < 3) ||
          (row < 3 && col > 7) ||
          (row > 7 && col < 3);

        if (finder || n % 3 === 0 || n % 5 === 0) {
          rects += `<rect x="${col}" y="${row}" width="1" height="1" fill="#111827"/>`;
        }
      }

      return `
        <svg width="70" height="70" viewBox="0 0 11 11" xmlns="http://www.w3.org/2000/svg">
          <rect width="11" height="11" fill="#ffffff"/>
          ${rects}
        </svg>
      `;
    }

    const labels = items
      .map(
        (p) => `
        <div class="label">
          <div class="name">${p.name}</div>
          <div class="price">${money(p.price)} / day</div>
          <div class="qr">${makeQR(p.barcode || p.id)}</div>
          <div class="code">${p.barcode || p.id}</div>
        </div>`
      )
      .join("");

    const html = `
      <html>
      <head>
        <title>${APP_NAME} QR Print</title>
        <style>
          body{font-family:Arial;padding:10px;color:#111827}
          .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
          h1{font-size:18px;margin:0}
          .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
          .label{border:1px solid #111827;border-radius:8px;padding:6px;text-align:center;page-break-inside:avoid}
          .name{font-weight:800;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .price{font-size:9px;margin:3px 0}
          .qr svg{display:block;margin:0 auto;width:60px;height:60px}
          .code{font-family:monospace;letter-spacing:1px;font-size:8px;margin-top:3px}
          button{background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 16px;font-weight:700}
          @media print{button{display:none}body{padding:6px}.grid{grid-template-columns:repeat(5,1fr)}}
        </style>
      </head>
      <body>
        <div class="top">
          <h1>${APP_NAME} QR Labels</h1>
          <button onclick="window.print()">Print QR</button>
        </div>
        <div class="grid">${labels}</div>
      </body>
      </html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();

    setTimeout(() => {
      win.print();
    }, 500);
  }

  function toggleBarcodeSelection(id) {
    setSelectedBarcodes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleBrandingImageUpload(field, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBranding((prev) => ({ ...prev, [field]: reader.result }));
    reader.readAsDataURL(file);
  }

  function handleCustomerPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCustomer((prev) => ({ ...prev, photo: reader.result }));
    reader.readAsDataURL(file);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProductForm((prev) => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  }

  function saveProduct(e) {
    e.preventDefault();
    if (!adminLoggedIn) return showToast("Admin login required");
    if (!productForm.name || !productForm.price || !productForm.stock) {
      showToast("Name, price and stock required");
      return;
    }

    if (editingProductId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProductId
            ? {
                ...p,
                name: productForm.name,
                category: productForm.category || "Other",
                price: Number(productForm.price),
                stock: Number(productForm.stock),
                barcode: productForm.barcode || Date.now().toString(),
                image: productForm.image || "https://via.placeholder.com/500x350?text=Product+Image",
                description: productForm.description || "Rental product description.",
              }
            : p
        )
      );
      showToast("Product updated");
    } else {
      const product = {
        id: Date.now().toString(),
        name: productForm.name,
        category: productForm.category || "Other",
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        barcode: productForm.barcode || Date.now().toString(),
        image: productForm.image || "https://via.placeholder.com/500x350?text=Product+Image",
        description: productForm.description || "Rental product description.",
      };
      setProducts((prev) => [product, ...prev]);
      showToast("Product added successfully");
    }

    setProductForm(emptyProduct());
    setEditingProductId(null);
  }

  function downloadInvoice(bookingData) {
    const data = bookingData || {
      id: "INV-" + Date.now().toString().slice(-6),
      customer,
      items: cartItems,
      rentalDays,
      lateDays,
      subtotal,
      lateFee,
      total,
      paidAmount,
      dueAmount,
      calculatedTotal,
      customTotal: customer.customTotal,
      paymentStatus: customer.paymentStatus,
      payments: paidAmount > 0 ? [{ amount: paidAmount, method: customer.paymentMethod || "Cash", note: "Initial payment", date: new Date().toLocaleString() }] : [],
      createdAt: new Date().toLocaleString(),
    };

    const rows = data.items
      .map(
        (item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${data.rentalDays}</td>
          <td>${money(item.price)}</td>
          <td>${money(item.price * item.quantity * data.rentalDays)}</td>
        </tr>`
      )
      .join("");

    const html = `
      <html>
      <head>
        <title>${APP_NAME} Invoice ${data.id}</title>
        <style>
          body{font-family:Arial;padding:35px;color:#111827}.logo{width:90px;height:90px;object-fit:contain;margin-bottom:8px}.top{display:flex;justify-content:space-between;gap:20px}.brand{color:#2563eb}h1{margin:0;font-size:32px}.box{background:#f3f4f6;padding:16px;border-radius:14px;margin:20px 0}
          table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#111827;color:white}th,td{padding:12px;border-bottom:1px solid #e5e7eb;text-align:left}.status{display:inline-block;padding:7px 12px;border-radius:999px;background:${data.paymentStatus === "Paid" ? "#dcfce7" : "#fee2e2"};color:${data.paymentStatus === "Paid" ? "#166534" : "#991b1b"};font-weight:bold}
          .total{width:360px;margin-left:auto;margin-top:20px}.total div{display:flex;justify-content:space-between;padding:8px 0}.grand{font-size:22px;font-weight:bold;border-top:2px solid #111827}.muted{color:#6b7280}button{background:#2563eb;color:white;border:0;padding:12px 18px;border-radius:10px;font-weight:bold}.payment-box{margin-top:25px;background:#f3f4f6;border-radius:14px;padding:14px;display:flex;justify-content:space-between;align-items:center}.bkashqr{width:95px;height:95px;object-fit:contain}.sign-row{display:flex;justify-content:space-between;margin-top:45px;gap:40px}.sign-row>div{text-align:center;width:220px}.sign-img,.stamp-img{height:70px;object-fit:contain;margin-bottom:6px}.line{border-top:1px solid #111827;margin-top:8px;padding-top:6px}@media print{button{display:none}}
        </style>
      </head>
      <body>
        <button onclick="window.print()">Download / Save PDF</button>
        <div class="top">
          <div>${branding.logo ? `<img src="${branding.logo}" class="logo" />` : ""}<h1><span class="brand">${APP_NAME}</span></h1><p class="muted">Rental Invoice</p></div>
          <div><b>Invoice:</b> ${data.id}<br/><b>Date:</b> ${data.createdAt}<br/><span class="status">${data.paymentStatus}</span></div>
        </div>
        <div class="box">
          <b>Customer:</b> ${data.customer.name || "Guest"}<br/>
          <b>Phone:</b> ${data.customer.phone || "N/A"}<br/>
          <b>Email:</b> ${data.customer.email || "N/A"}<br/>
          <b>Address:</b> ${data.customer.address || "N/A"}<br/>
          ${data.customer.photo ? `<div style="margin-top:10px"><b>Customer Photo:</b><br/><img src="${data.customer.photo}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:1px solid #ddd;margin-top:6px" /></div>` : ""}
          <b>Rental:</b> ${data.customer.startDate || "N/A"} to ${data.customer.returnDate || "N/A"} (${data.rentalDays} day)<br/>
          <b>Actual Return:</b> ${data.customer.actualReturnDate || "N/A"} | <b>Late Days:</b> ${data.lateDays}<br/>
          <b>Note:</b> ${data.customer.note || "N/A"}
        </div>
        <table><thead><tr><th>Product</th><th>Qty</th><th>Days</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="total">
          <div><span>Subtotal</span><b>${money(data.subtotal)}</b></div>
                    <div><span>Late Fee</span><b>${money(data.lateFee)}</b></div>
          <div class="grand"><span>Total</span><span>${money(data.total)}</span></div>
          <div><span>Paid</span><b>${money(data.paidAmount)}</b></div>
          <div><span>Due</span><b>${money(data.dueAmount)}</b></div>
          <div><span>Payment Methods</span><b>${(data.payments || []).map(p => `${p.method || "Cash"}: ${money(p.amount)}`).join(", ") || "N/A"}</b></div>
        </div>
        <div class="payment-box">
          <div><b>bKash Payment</b><br/>Number: ${branding.bkashNumber || "N/A"}</div>
          ${branding.bkashQR ? `<img src="${branding.bkashQR}" class="bkashqr" />` : ""}
        </div>
        <div class="sign-row">
          <div>${branding.signature ? `<img src="${branding.signature}" class="sign-img" />` : ""}<div class="line"></div><b>Authorized Signature</b></div>
          <div>${branding.stamp ? `<img src="${branding.stamp}" class="stamp-img" />` : ""}<div class="line"></div><b>Company Stamp</b></div>
        </div>
      </body>
      </html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  function completeBooking() {
    if (!cartItems.length) return showToast("Cart is empty");
    const booking = {
      id: "BK-" + Date.now().toString().slice(-6),
      customer,
      items: cartItems,
      rentalDays,
      lateDays,
      subtotal,
      lateFee,
      total,
      paidAmount,
      dueAmount,
      calculatedTotal,
      customTotal: customer.customTotal,
      paymentStatus: customer.paymentStatus,
      payments: paidAmount > 0 ? [{ amount: paidAmount, method: customer.paymentMethod || "Cash", note: "Initial payment", date: new Date().toLocaleString() }] : [],
      createdAt: new Date().toLocaleString(),
    };
    setBookings((prev) => [booking, ...prev]);
    downloadInvoice(booking);
    setCart([]);
    setCartOpen(false);
    setCustomer({ name: "", phone: "", email: "", address: "", photo: "", startDate: "", returnDate: "", actualReturnDate: "", paymentStatus: "Due", paymentMethod: "Cash", paidAmount: "", note: "", customTotal: "" });
    showToast("Booking completed");
  }

  function recalculateBooking(booking, nextCustomer = booking.customer, nextPayments = booking.payments || []) {
    const nextRentalDays = daysBetween(nextCustomer.startDate, nextCustomer.returnDate);
    const nextLateDays = nextCustomer.actualReturnDate ? Math.max(0, daysBetween(nextCustomer.returnDate, nextCustomer.actualReturnDate) - 1) : 0;
    const nextDailyRate = (booking.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const nextSubtotal = nextDailyRate * nextRentalDays;
    const nextLateFee = nextDailyRate * nextLateDays;
    const nextTotal = nextSubtotal + nextLateFee;
    const nextPaidAmount = nextPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const nextDueAmount = Math.max(0, nextTotal - nextPaidAmount);

    return {
      ...booking,
      customer: nextCustomer,
      rentalDays: nextRentalDays,
      lateDays: nextLateDays,
      subtotal: nextSubtotal,
      lateFee: nextLateFee,
      total: nextTotal,
      paidAmount: nextPaidAmount,
      dueAmount: nextDueAmount,
      paymentStatus: nextDueAmount <= 0 ? "Paid" : "Due",
      payments: nextPayments,
    };
  }

  function deleteBooking(id) {
    if (!adminLoggedIn) return showToast("Admin login required");
    setBookings((prev) => prev.filter((b) => b.id !== id));
    if (selectedBooking?.id === id) setSelectedBooking(null);
    showToast("Booking deleted");
  }

  function startEditBooking(booking) {
    if (!adminLoggedIn) return showToast("Admin login required");
    setEditingBooking(JSON.parse(JSON.stringify(booking)));
  }

  function saveBookingEdit(e) {
    e.preventDefault();
    if (!adminLoggedIn) return showToast("Admin login required");
    if (!editingBooking) return;

    const updated = recalculateBooking(editingBooking, editingBooking.customer, editingBooking.payments || []);
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    if (selectedBooking?.id === updated.id) setSelectedBooking(updated);
    setEditingBooking(null);
    showToast("Booking updated");
  }

  function addPaymentToBooking(booking) {
    if (!adminLoggedIn) return showToast("Admin login required");
    const amount = Number(paymentForm.amount || 0);
    if (amount <= 0) return showToast("Payment amount required");

    const nextPayments = [
      ...(booking.payments || []),
      { amount, method: paymentForm.method || "Cash", note: paymentForm.note || "Payment", date: new Date().toLocaleString() },
    ];
    const updated = recalculateBooking(booking, booking.customer, nextPayments);

    setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)));
    setSelectedBooking(updated);
    setPaymentForm({ amount: "", method: "Cash", note: "" });
    showToast("Payment added");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <style>{`
        @keyframes brandFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.04); }
        }
        @keyframes brandGlow {
          from { filter: drop-shadow(0 0 4px rgba(34,211,238,.45)); }
          to { filter: drop-shadow(0 0 16px rgba(96,165,250,.95)); }
        }
        @keyframes newsSlide {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1
              className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-blue-300"
              style={{ animation: "brandFloat 2.4s ease-in-out infinite, brandGlow 1.8s ease-in-out infinite alternate" }}
            >
              {APP_NAME}
            </h1>
            <p className="text-xs text-slate-400">Rental, booking, invoice and admin panel</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDashboardOpen((prev) => !prev)} className="hidden rounded-2xl bg-white/10 px-4 py-3 font-bold hover:bg-white/20 sm:block">Dashboard</button>
            <span className={firebaseLoaded ? "hidden rounded-2xl bg-green-500/20 px-3 py-2 text-xs font-bold text-green-200 sm:block" : "hidden rounded-2xl bg-yellow-500/20 px-3 py-2 text-xs font-bold text-yellow-200 sm:block"}>
              {firebaseLoaded ? "Backup Ready" : "Loading Backup..."}
            </span>
            <button onClick={() => setBkashMenuOpen(true)} className="hidden rounded-2xl bg-pink-600 px-4 py-3 font-bold hover:bg-pink-700 sm:block">Payment bKash</button>
            <button onClick={() => setBarcodeMenuOpen(true)} className="hidden rounded-2xl bg-white/10 px-4 py-3 font-bold hover:bg-white/20 sm:block">QR Print</button>
            <button onClick={() => {
              if (!adminLoggedIn) setAdminLoginOpen(true);
              else setAdminPanelOpen((prev) => !prev);
            }} className="hidden rounded-2xl bg-white/10 px-4 py-3 font-bold hover:bg-white/20 sm:block">Admin</button>
            <button onClick={() => setCartOpen(true)} className="rounded-2xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-700">Cart ({cartCount})</button>
          </div>
        </div>
      </div>

      {branding.newsEnabled && branding.newsText && (
        <div className="border-b border-cyan-400/20 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 overflow-hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <span className="shrink-0 rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-slate-950 shadow-lg shadow-cyan-400/30">NEWS</span>
            <div className="relative flex-1 overflow-hidden whitespace-nowrap">
              <div className="inline-block font-bold text-cyan-100" style={{ animation: "newsSlide 18s linear infinite" }}>
                {branding.newsText}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-[32px] bg-gradient-to-r from-blue-600 to-cyan-500 p-8 shadow-2xl md:p-12">
          <h2 className="max-w-3xl text-4xl font-black md:text-6xl">{APP_NAME}</h2>
          <p className="mt-4 max-w-2xl text-lg text-blue-50">Professional sound system rental app with Firebase backup, admin login, product edit, late fee, payment status and customer booking details.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#products" className="rounded-2xl bg-white px-6 py-3 font-bold text-slate-950">Products</a>
            <a href="#bookings" className="rounded-2xl bg-slate-950/30 px-6 py-3 font-bold text-white">Bookings</a>
          </div>
        </section>

        {dashboardOpen && (
          <section id="dashboard" className="py-10">
            <div className="mb-5">
              <h2 className="text-3xl font-black">Dashboard</h2>
              <p className="text-slate-400">{APP_NAME} business summary</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl transition hover:-translate-y-1">
                <p className="text-sm text-slate-400">Total Products</p>
                <h3 className="mt-2 text-3xl font-black">{dashboardStats.totalProducts}</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl transition hover:-translate-y-1">
                <p className="text-sm text-slate-400">Total Bookings</p>
                <h3 className="mt-2 text-3xl font-black">{dashboardStats.totalBookings}</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl transition hover:-translate-y-1">
                <p className="text-sm text-slate-400">Total Revenue</p>
                <h3 className="mt-2 text-3xl font-black">{money(dashboardStats.totalRevenue)}</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl transition hover:-translate-y-1">
                <p className="text-sm text-slate-400">Total Due</p>
                <h3 className="mt-2 text-3xl font-black text-red-300">{money(dashboardStats.totalDue)}</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl transition hover:-translate-y-1">
                <p className="text-sm text-slate-400">Total Paid</p>
                <h3 className="mt-2 text-3xl font-black text-green-300">{money(dashboardStats.totalPaid)}</h3>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl transition hover:-translate-y-1">
                <p className="text-sm text-slate-400">Total Late Fee</p>
                <h3 className="mt-2 text-3xl font-black text-yellow-300">{money(dashboardStats.totalLateFee)}</h3>
              </div>
            </div>
          </section>
        )}

        <section id="products" className="py-10">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-black">Products</h2>
              <p className="text-slate-400">Customer এখান থেকে product cart-এ add করবে।</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product..." className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 outline-none focus:border-blue-400 md:w-72" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400">
                {categories.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-4 shadow-xl transition hover:-translate-y-1 hover:bg-white/15">
                <img src={p.image} alt={p.name} className="h-44 w-full rounded-2xl object-cover" />
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase text-blue-300">{p.category}</div>
                  <h3 className="mt-1 text-lg font-black">{p.name}</h3>
                  <p className="mt-2 min-h-10 text-sm text-slate-400">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-black">{money(p.price)}</div>
                      <div className="text-xs text-slate-400">per day · stock {p.stock}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500">Barcode: {p.barcode || p.id}</div>
                    </div>
                    <button onClick={() => addToCart(p)} className="rounded-2xl bg-blue-600 px-4 py-3 font-bold hover:bg-blue-700">Add</button>
                  </div>
                  {adminLoggedIn && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => editProduct(p)} className="rounded-2xl bg-yellow-500/20 px-4 py-2 text-sm font-bold text-yellow-200 hover:bg-yellow-500/30">Edit</button>
                      <button onClick={() => deleteProduct(p.id)} className="rounded-2xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {adminLoginOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4">
          <form onSubmit={(e) => { e.preventDefault(); loginAdmin(e); setAdminLoginOpen(false); setAdminPanelOpen(true); }} className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black">Admin Login</h2>
              <button type="button" onClick={() => setAdminLoginOpen(false)} className="rounded-full bg-white/10 px-4 py-2 font-bold">X</button>
            </div>
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Enter admin password" className="w-full rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400" />
            <button className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-700">Login</button>
          </form>
        </div>
      )}

      {adminPanelOpen && (
          <section id="admin" className="py-10">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-3xl font-black">Admin Panel</h2>
                <p className="text-slate-400">Login করলে product add/edit/delete করা যাবে।</p>
              </div>
              {adminLoggedIn && <button onClick={() => setAdminLoggedIn(false)} className="rounded-2xl bg-red-500/20 px-5 py-3 font-bold text-red-200">Logout Admin</button>}
            </div>

            {adminLoggedIn && (
              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-5">
                <h3 className="text-2xl font-black">Invoice Branding Settings</h3>
                <p className="text-slate-400">Logo, signature, stamp এবং bKash QR invoice-এ show হবে।</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="mb-3 h-24 rounded-2xl bg-white/10 p-2">{branding.logo ? <img src={branding.logo} alt="logo" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-slate-400">Logo</div>}</div>
                    <label className="block cursor-pointer rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-950">Upload Logo<input type="file" accept="image/*" onChange={(e) => handleBrandingImageUpload("logo", e.target.files?.[0])} className="hidden" /></label>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="mb-3 h-24 rounded-2xl bg-white/10 p-2">{branding.signature ? <img src={branding.signature} alt="signature" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-slate-400">Signature</div>}</div>
                    <label className="block cursor-pointer rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-950">Upload Signature<input type="file" accept="image/*" onChange={(e) => handleBrandingImageUpload("signature", e.target.files?.[0])} className="hidden" /></label>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="mb-3 h-24 rounded-2xl bg-white/10 p-2">{branding.stamp ? <img src={branding.stamp} alt="stamp" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-slate-400">Stamp</div>}</div>
                    <label className="block cursor-pointer rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-950">Upload Stamp<input type="file" accept="image/*" onChange={(e) => handleBrandingImageUpload("stamp", e.target.files?.[0])} className="hidden" /></label>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <div className="mb-3 h-24 rounded-2xl bg-white/10 p-2">{branding.bkashQR ? <img src={branding.bkashQR} alt="bkash qr" className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-sm text-slate-400">bKash QR</div>}</div>
                    <label className="block cursor-pointer rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-950">Upload bKash QR<input type="file" accept="image/*" onChange={(e) => handleBrandingImageUpload("bkashQR", e.target.files?.[0])} className="hidden" /></label>
                  </div>
                </div>
                <input value={branding.bkashNumber} onChange={(e) => setBranding({ ...branding, bkashNumber: e.target.value })} placeholder="bKash number" className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-3 outline-none focus:border-blue-400" />
                <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black">Newsfeed Control</h3>
                      <p className="text-sm text-slate-400">Header-এর নিচে animated update message show হবে।</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-bold">
                      <input type="checkbox" checked={branding.newsEnabled} onChange={(e) => setBranding({ ...branding, newsEnabled: e.target.checked })} />
                      Show
                    </label>
                  </div>
                  <textarea value={branding.newsText} onChange={(e) => setBranding({ ...branding, newsText: e.target.value })} placeholder="Newsfeed message লিখুন..." className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-3 outline-none focus:border-cyan-400" />
                </div>
              </div>
            )}

            {!adminLoggedIn ? (
              <form onSubmit={loginAdmin} className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row">
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400" />
                <button className="rounded-2xl bg-blue-600 px-6 py-3 font-black hover:bg-blue-700">Login</button>
              </form>
            ) : (
              <form onSubmit={saveProduct} className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-3xl border border-dashed border-white/20 bg-slate-900 p-4">
                  {productForm.image ? <img src={productForm.image} alt="preview" className="h-72 w-full rounded-2xl object-cover" /> : <div className="grid h-72 place-items-center rounded-2xl bg-slate-800 text-slate-400">Image Preview</div>}
                  <label className="mt-4 block cursor-pointer rounded-2xl bg-white px-5 py-3 text-center font-bold text-slate-950 hover:bg-slate-200">
                    Upload Product Image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400" />
                  <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Category" className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400" />
                  <input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="Price per day" className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400" />
                  <input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="Stock" className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400" />
                  <input value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} placeholder="Barcode number" className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
                  {productForm.barcode && <div className="sm:col-span-2"><QRPreview value={productForm.barcode} /></div>}
                  <textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Description" className="min-h-32 rounded-2xl border border-white/10 bg-slate-900 px-5 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
                  <button className="rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-700 sm:col-span-2">{editingProductId ? "Update Product" : "Add Product"}</button>
                  {editingProductId && <button type="button" onClick={() => { setEditingProductId(null); setProductForm(emptyProduct()); }} className="rounded-2xl bg-white/10 px-5 py-4 font-black hover:bg-white/20 sm:col-span-2">Cancel Edit</button>}
                </div>
              </form>
            )}
          </div>
          </section>
        )}

        <section id="bookings" className="py-10">
          <h2 className="text-3xl font-black">Customer Booking Details</h2>
          <div className="mt-5 grid gap-4">
            {bookings.length === 0 && <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">No booking yet.</div>}
            {bookings.map((b) => (
              <div key={b.id} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h3 className="text-xl font-black">{b.id}</h3>
                    <p className="text-slate-400">{b.customer.name || "Guest"} · {b.customer.phone || "No phone"} · {b.customer.address || "No address"} · {b.createdAt}</p>
                    <p className="mt-1 text-sm text-slate-400">Return: {b.customer.returnDate || "N/A"} · Late: {b.lateDays} day · Payment: <span className={b.paymentStatus === "Paid" ? "text-green-300" : "text-red-300"}>{b.paymentStatus}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedBooking(b)} className="rounded-2xl bg-white/10 px-4 py-3 font-bold hover:bg-white/20">View Details</button>
                    <button onClick={() => downloadInvoice(b)} className="rounded-2xl bg-blue-600 px-4 py-3 font-bold hover:bg-blue-700">Invoice</button>
                    {adminLoggedIn && <button onClick={() => startEditBooking(b)} className="rounded-2xl bg-yellow-500/20 px-4 py-3 font-bold text-yellow-200 hover:bg-yellow-500/30">Edit</button>}
                    {adminLoggedIn && <button onClick={() => deleteBooking(b.id)} className="rounded-2xl bg-red-500/20 px-4 py-3 font-bold text-red-200 hover:bg-red-500/30">Delete</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-slate-950 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-3xl font-black">Cart</h2><p className="text-slate-400">{APP_NAME} booking invoice.</p></div>
              <button onClick={() => setCartOpen(false)} className="rounded-full bg-white/10 px-4 py-2 font-bold hover:bg-white/20">X</button>
            </div>

            <div className="grid gap-3">
              {cartItems.length === 0 && <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">Cart is empty.</div>}
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-4 rounded-3xl border border-white/10 bg-white/10 p-3">
                  <img src={item.image} alt={item.name} className="h-24 w-24 rounded-2xl object-cover" />
                  <div className="flex-1">
                    <div className="flex justify-between gap-3"><div><h3 className="font-black">{item.name}</h3><p className="text-sm text-slate-400">{money(item.price)} / day</p></div><button onClick={() => removeItem(item.id)} className="text-red-300 hover:text-red-200">Remove</button></div>
                    <div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-3 rounded-2xl bg-slate-900 p-2"><button onClick={() => updateQty(item.id, -1)} className="rounded-xl bg-white/10 px-3 py-1 font-bold">-</button><span className="font-black">{item.quantity}</span><button onClick={() => updateQty(item.id, 1)} className="rounded-xl bg-white/10 px-3 py-1 font-bold">+</button></div><b>{money(item.price * item.quantity * rentalDays)}</b></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5">
              <h3 className="text-xl font-black">Customer, Return & Payment</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Customer name" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
                <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
                <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
                <textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Customer address" className="min-h-20 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
                <div className="rounded-2xl border border-white/10 bg-slate-900 p-3 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    {customer.photo ? <img src={customer.photo} alt="customer" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-xs text-slate-400">Photo</div>}
                    <label className="cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-200">
                      Upload Customer Photo
                      <input type="file" accept="image/*" onChange={handleCustomerPhotoUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <label className="text-sm text-slate-400">Start Date<input type="date" value={customer.startDate} onChange={(e) => setCustomer({ ...customer, startDate: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>
                <label className="text-sm text-slate-400">Return Date<input type="date" value={customer.returnDate} onChange={(e) => setCustomer({ ...customer, returnDate: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>
                <label className="text-sm text-slate-400">Actual Return Date<input type="date" value={customer.actualReturnDate} onChange={(e) => setCustomer({ ...customer, actualReturnDate: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>
                <label className="text-sm text-slate-400">Payment Status<select value={customer.paymentStatus} onChange={(e) => setCustomer({ ...customer, paymentStatus: e.target.value, paidAmount: e.target.value === "Paid" ? total : customer.paidAmount })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400"><option>Due</option><option>Paid</option></select></label>
                <label className="text-sm text-slate-400">Payment Method<select value={customer.paymentMethod} onChange={(e) => setCustomer({ ...customer, paymentMethod: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400"><option>Cash</option><option>BIKASH</option></select></label>
                <input type="number" value={customer.paidAmount} onChange={(e) => setCustomer({ ...customer, paidAmount: e.target.value })} placeholder="Paid amount" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
                <textarea value={customer.note} onChange={(e) => setCustomer({ ...customer, note: e.target.value })} placeholder="Booking note" className="min-h-20 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
                <input type="number" value={customer.customTotal} onChange={(e) => setCustomer({ ...customer, customTotal: e.target.value })} placeholder={`Custom total amount (auto: ${money(calculatedTotal)})`} className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 font-bold text-yellow-100 outline-none focus:border-yellow-300 sm:col-span-2" />
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5">
              <div className="flex justify-between py-2 text-slate-300"><span>Rental days</span><b>{rentalDays}</b></div>
              <div className="flex justify-between py-2 text-slate-300"><span>Late days</span><b>{lateDays}</b></div>
              <div className="flex justify-between py-2 text-slate-300"><span>Subtotal</span><b>{money(subtotal)}</b></div>
                            <div className="flex justify-between py-2 text-slate-300"><span>Late fee</span><b>{money(lateFee)}</b></div>
              <div className="flex justify-between py-2 text-slate-300"><span>Auto total</span><b>{money(calculatedTotal)}</b></div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-4 text-2xl font-black"><span>Final Total</span><span>{money(total)}</span></div>
              <div className="flex justify-between py-2 text-slate-300"><span>Paid</span><b>{money(paidAmount)}</b></div>
              <div className="flex justify-between py-2 text-slate-300"><span>Due</span><b>{money(dueAmount)}</b></div>
              <button onClick={completeBooking} className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-700">Complete Booking & PDF Invoice</button>
            </div>
          </aside>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-slate-950 p-6 shadow-2xl border border-white/10">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-3xl font-black">Booking Details</h2><button onClick={() => setSelectedBooking(null)} className="rounded-full bg-white/10 px-4 py-2 font-bold">X</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4">
                <b>Customer</b>
                <div className="mt-3 flex gap-3">
                  {selectedBooking.customer.photo && <img src={selectedBooking.customer.photo} alt="customer" className="h-20 w-20 rounded-2xl object-cover" />}
                  <p className="text-slate-300">{selectedBooking.customer.name || "Guest"}<br/>{selectedBooking.customer.phone || "N/A"}<br/>{selectedBooking.customer.email || "N/A"}<br/>{selectedBooking.customer.address || "N/A"}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4"><b>Payment</b><p className="text-slate-300">Status: {selectedBooking.paymentStatus}<br/>Paid: {money(selectedBooking.paidAmount)}<br/>Due: {money(selectedBooking.dueAmount)}</p></div>
              <div className="rounded-2xl bg-white/10 p-4"><b>Dates</b><p className="text-slate-300">Start: {selectedBooking.customer.startDate || "N/A"}<br/>Return: {selectedBooking.customer.returnDate || "N/A"}<br/>Actual: {selectedBooking.customer.actualReturnDate || "N/A"}<br/>Late: {selectedBooking.lateDays} day</p></div>
              <div className="rounded-2xl bg-white/10 p-4"><b>Total</b><p className="text-slate-300">Subtotal: {money(selectedBooking.subtotal)}<br/>Late Fee: {money(selectedBooking.lateFee)}<br/>Total: {money(selectedBooking.total)}</p></div>
            </div>
            {adminLoggedIn && (
              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <h3 className="text-xl font-black">Add Payment</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="Payment amount" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
                  <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400">
                    <option>Cash</option>
                    <option>BIKASH</option>
                  </select>
                  <input value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Payment note" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
                  <button onClick={() => addPaymentToBooking(selectedBooking)} className="rounded-2xl bg-green-600 px-5 py-3 font-black hover:bg-green-700">Add</button>
                </div>
              </div>
            )}

            <h3 className="mt-5 text-xl font-black">Payment History</h3>
            <div className="mt-3 grid gap-3">
              {(!selectedBooking.payments || selectedBooking.payments.length === 0) && <div className="rounded-2xl bg-white/10 p-4 text-slate-400">No payment history.</div>}
              {(selectedBooking.payments || []).map((pay, index) => <div key={index} className="flex flex-col justify-between gap-2 rounded-2xl bg-white/10 p-4 sm:flex-row sm:items-center"><span>{pay.date} · {pay.method || "Cash"} · {pay.note || "Payment"}</span><b>{money(pay.amount)}</b></div>)}
            </div>

            <h3 className="mt-5 text-xl font-black">Products</h3>
            <div className="mt-3 grid gap-3">
              {selectedBooking.items.map((item) => <div key={item.id} className="flex justify-between rounded-2xl bg-white/10 p-4"><span>{item.name} × {item.quantity}</span><b>{money(item.price * item.quantity * selectedBooking.rentalDays)}</b></div>)}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {adminLoggedIn && <button onClick={() => startEditBooking(selectedBooking)} className="rounded-2xl bg-yellow-500/20 px-5 py-4 font-black text-yellow-200 hover:bg-yellow-500/30">Edit Booking</button>}
              {adminLoggedIn && <button onClick={() => deleteBooking(selectedBooking.id)} className="rounded-2xl bg-red-500/20 px-5 py-4 font-black text-red-200 hover:bg-red-500/30">Delete Booking</button>}
              <button onClick={() => downloadInvoice(selectedBooking)} className="rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-700">Download Invoice</button>
            </div>
          </div>
        </div>
      )}

      {bkashMenuOpen && (
        <div className="fixed inset-0 z-[71] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 text-center shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black">Payment bKash</h2>
              <button onClick={() => setBkashMenuOpen(false)} className="rounded-full bg-white/10 px-4 py-2 font-bold hover:bg-white/20">X</button>
            </div>
            <div className="rounded-3xl bg-white p-5 text-slate-950">
              {branding.bkashQR ? (
                <img src={branding.bkashQR} alt="bKash QR" className="mx-auto h-64 w-64 object-contain" />
              ) : (
                <div className="grid h-64 w-full place-items-center rounded-2xl bg-slate-100 text-slate-500">
                  Admin Panel থেকে bKash QR upload করো
                </div>
              )}
              <h3 className="mt-4 text-xl font-black">{APP_NAME}</h3>
              <p className="mt-1 text-sm text-slate-600">bKash Number: {branding.bkashNumber || "Not added"}</p>
            </div>
          </div>
        </div>
      )}

      {barcodeMenuOpen && (
        <div className="fixed inset-0 z-[72] grid place-items-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-3xl font-black">QR Print</h2>
                <p className="text-slate-400">প্রডাক্ট select করে ছোট QR label print করো। Label-এ product name এবং price থাকবে।</p>
              </div>
              <div className="flex gap-2">
                <button onClick={printSelectedBarcodes} className="rounded-2xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-700">Print Selected</button>
                <button onClick={() => setBarcodeMenuOpen(false)} className="rounded-2xl bg-white/10 px-5 py-3 font-black hover:bg-white/20">Close</button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <label key={p.id} className={selectedBarcodes.includes(p.id) ? "cursor-pointer rounded-3xl border border-blue-400 bg-blue-500/20 p-4" : "cursor-pointer rounded-3xl border border-white/10 bg-white/10 p-4 hover:bg-white/15"}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">{p.name}</h3>
                      <p className="text-sm text-slate-400">{money(p.price)} / day</p>
                    </div>
                    <input type="checkbox" checked={selectedBarcodes.includes(p.id)} onChange={() => toggleBarcodeSelection(p.id)} className="h-5 w-5" />
                  </div>
                  <QRPreview value={p.barcode || p.id} small />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingBooking && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/60 p-4">
          <form onSubmit={saveBookingEdit} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-3xl font-black">Edit Booking</h2>
              <button type="button" onClick={() => setEditingBooking(null)} className="rounded-full bg-white/10 px-4 py-2 font-bold">X</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input value={editingBooking.customer.name || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, name: e.target.value } })} placeholder="Customer name" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
              <input value={editingBooking.customer.phone || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, phone: e.target.value } })} placeholder="Phone" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
              <input value={editingBooking.customer.email || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, email: e.target.value } })} placeholder="Email" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
              <textarea value={editingBooking.customer.address || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, address: e.target.value } })} placeholder="Address" className="min-h-20 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400 sm:col-span-2" />
              <label className="text-sm text-slate-400">Start Date<input type="date" value={editingBooking.customer.startDate || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, startDate: e.target.value } })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-slate-400">Return Date<input type="date" value={editingBooking.customer.returnDate || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, returnDate: e.target.value } })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>
              <label className="text-sm text-slate-400">Actual Return Date<input type="date" value={editingBooking.customer.actualReturnDate || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, actualReturnDate: e.target.value } })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>
              <textarea value={editingBooking.customer.note || ""} onChange={(e) => setEditingBooking({ ...editingBooking, customer: { ...editingBooking.customer, note: e.target.value } })} placeholder="Booking note" className="min-h-20 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
            </div>

            <h3 className="mt-5 text-xl font-black">Payment History</h3>
            <div className="mt-3 grid gap-3">
              {(!editingBooking.payments || editingBooking.payments.length === 0) && <div className="rounded-2xl bg-white/10 p-4 text-slate-400">No payment history.</div>}
              {(editingBooking.payments || []).map((pay, index) => (
                <div key={index} className="grid gap-2 rounded-2xl bg-white/10 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input type="number" value={pay.amount || ""} onChange={(e) => setEditingBooking({ ...editingBooking, payments: (editingBooking.payments || []).map((p, i) => i === index ? { ...p, amount: Number(e.target.value || 0) } : p) })} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
                  <select value={pay.method || "Cash"} onChange={(e) => setEditingBooking({ ...editingBooking, payments: (editingBooking.payments || []).map((p, i) => i === index ? { ...p, method: e.target.value } : p) })} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"><option>Cash</option><option>BIKASH</option></select>
                  <input value={pay.note || ""} onChange={(e) => setEditingBooking({ ...editingBooking, payments: (editingBooking.payments || []).map((p, i) => i === index ? { ...p, note: e.target.value } : p) })} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400" />
                  <button type="button" onClick={() => setEditingBooking({ ...editingBooking, payments: (editingBooking.payments || []).filter((_, i) => i !== index) })} className="rounded-2xl bg-red-500/20 px-4 py-3 font-bold text-red-200">Remove</button>
                </div>
              ))}
            </div>

            <button type="submit" className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-700">Save Booking Changes</button>
          </form>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-2xl bg-white px-5 py-3 font-bold text-slate-950 shadow-2xl">{toast}</div>}
    </div>
  );
}
