export type TranslationKeys = {
  // Common
  'app.title': string
  'app.name': string
  'pos.terminal': string
  'lang.en': string
  'lang.ur': string

  // Navigation/Sidebar
  'nav.dashboard': string
  'nav.posTerminal': string
  'nav.inventory': string
  'nav.customers': string
  'nav.reports': string
  'nav.settings': string
  'nav.signOut': string

  // Header
  'header.search': string
  'header.search.mobile': string

  // Dashboard
  'dashboard.title': string
  'dashboard.welcome': string
  'dashboard.totalRevenue': string
  'dashboard.salesCount': string
  'dashboard.activeCustomers': string
  'dashboard.lowStock': string
  'dashboard.fromLastMonth': string
  'dashboard.realtimeSales': string
  'dashboard.topCategories': string
  'dashboard.dailyRevenue': string
  'dashboard.thisWeek': string
  'dashboard.avgDailyRevenue': string
  'dashboard.totalOrders': string
  'dashboard.bestDay': string
  'dashboard.processedBy': string
  'dashboard.minsAgo': string

  // Categories
  'category.all': string
  'category.special': string
  'category.soups': string
  'category.desserts': string
  'category.chickens': string

  // Menu
  'menu.title': string
  'menu.outOfStock': string
  'menu.left': string
  'menu.items': string

  // Cart
  'cart.title': string
  'cart.table': string
  'cart.order': string
  'cart.people': string
  'cart.clear': string
  'cart.empty': string
  'cart.orderedItems': string
  'cart.qty': string
  'cart.total': string

  // Payment
  'payment.summary': string
  'payment.subtotal': string
  'payment.tax': string
  'payment.donation': string
  'payment.total': string
  'payment.totalPayable': string
  'payment.method': string
  'payment.cash': string
  'payment.card': string
  'payment.scan': string
  'payment.print': string
  'payment.checkout': string
  'payment.placeOrder': string

  // Receipt
  'receipt.title': string
  'receipt.thankYou': string
  'receipt.comeAgain': string
  'receipt.print': string

  // Inventory
  'inventory.title': string
  'inventory.subtitle': string
  'inventory.addProduct': string
  'inventory.totalProducts': string
  'inventory.inStock': string
  'inventory.lowStock': string
  'inventory.outOfStock': string
  'inventory.searchPlaceholder': string
  'inventory.product': string
  'inventory.sku': string
  'inventory.category': string
  'inventory.price': string
  'inventory.stock': string
  'inventory.status': string
  'inventory.actions': string
  'inventory.min': string
  'inventory.restock': string
  'inventory.edit': string
  'inventory.delete': string
  'inventory.addNewProduct': string
  'inventory.enterProductDetails': string
  'inventory.productName': string
  'inventory.enterProductName': string
  'inventory.enterSku': string
  'inventory.minStock': string
  'inventory.cancel': string
  'inventory.add': string
  'inventory.update': string
  'inventory.editProduct': string
  'inventory.updateProduct': string
  'inventory.productAdded': string
  'inventory.productUpdated': string
  'inventory.productDeleted': string
  'inventory.missingFields': string
  'inventory.fillRequired': string
  'inventory.productImage': string
  'inventory.bulkImport': string
  'inventory.importResult': string
  'inventory.importFailed': string
  'inventory.someRowsFailed': string
  'inventory.errorsOccurred': string
  'inventory.importSuccessMsg': string
  'inventory.importErrorMsg': string
  'inventory.errorDetails': string
  'inventory.uploadFile': string
  'inventory.exampleFile': string

  // Customers
  'customers.title': string
  'customers.subtitle': string
  'customers.addCustomer': string
  'customers.totalCustomers': string
  'customers.active': string
  'customers.inactive': string
  'customers.totalRevenue': string
  'customers.searchPlaceholder': string
  'customers.joined': string
  'customers.allTime': string
  'customers.activeCustomers': string
  'customers.noRecentOrders': string
  'customers.fromAllCustomers': string
  'customers.addNewCustomer': string
  'customers.enterCustomerDetails': string
  'customers.fullName': string
  'customers.enterFullName': string
  'customers.email': string
  'customers.enterEmail': string
  'customers.phone': string
  'customers.enterPhone': string
  'customers.editCustomer': string
  'customers.updateCustomer': string
  'customers.customerAdded': string
  'customers.customerUpdated': string
  'customers.customerDeleted': string

  // Reports
  'reports.title': string
  'reports.subtitle': string
  'reports.totalRevenue': string
  'reports.totalOrders': string
  'reports.totalCustomers': string
  'reports.avgOrderValue': string
  'reports.profitMargin': string
  'reports.fromLastPeriod': string
  'reports.salesOverview': string
  'reports.salesByCategory': string
  'reports.topProducts': string
  'reports.dailyBreakdown': string
  'reports.day': string
  'reports.sales': string
  'reports.customers': string
  'reports.orders': string
  'reports.export': string
  'reports.today': string
  'reports.thisWeek': string
  'reports.thisMonth': string
  'reports.thisYear': string

  // Settings
  'settings.title': string
  'settings.subtitle': string
  'settings.storeInfo': string
  'settings.updateStoreDetails': string
  'settings.storeName': string
  'settings.storeAddress': string
  'settings.contactNumber': string
  'settings.email': string
  'settings.notifications': string
  'settings.configureNotifications': string
  'settings.lowStockAlerts': string
  'settings.lowStockDesc': string
  'settings.dailySalesSummary': string
  'settings.dailySalesDesc': string
  'settings.newCustomerAlerts': string
  'settings.newCustomerDesc': string
  'settings.paymentSettings': string
  'settings.configurePayment': string
  'settings.defaultCurrency': string
  'settings.taxRate': string
  'settings.appearance': string
  'settings.customizeLook': string
  'settings.theme': string
  'settings.itemsPerPage': string
  'settings.saveChanges': string
  'settings.saved': string
  'settings.preferencesUpdated': string
  'settings.themeChanged': string
  'settings.switchedTo': string
  'settings.currentTheme': string
  'settings.light': string
  'settings.dark': string

  // Messages
  'msg.cartEmpty': string
  'msg.cartEmptyDesc': string
  'msg.addedToCart': string
  'msg.removed': string
  'msg.cleared': string
  'msg.paymentSuccess': string
  'msg.orderPlaced': string
  'msg.outOfStock': string
  'msg.cannotAddMore': string
  'msg.stockRestored': string
  'msg.invalidQuantity': string
  'msg.enterValidQuantity': string
}

export const translations: Record<'en' | 'ur', TranslationKeys> = {
  // English
  en: {
    'app.title': 'Tasty Station',
    'app.name': 'Elites POS',
    'pos.terminal': 'POS Terminal',
    'lang.en': 'English',
    'lang.ur': 'اردو',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.posTerminal': 'POS Terminal',
    'nav.inventory': 'Inventory',
    'nav.customers': 'Customers',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.signOut': 'Sign Out',

    'header.search': 'Search menu, orders and more',
    'header.search.mobile': 'Search menu...',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back, Admin. Here\'s what\'s happening today.',
    'dashboard.totalRevenue': 'Total Revenue',
    'dashboard.salesCount': 'Sales Count',
    'dashboard.activeCustomers': 'Total Customers',
    'dashboard.lowStock': 'Low Stock Items',
    'dashboard.fromLastMonth': 'from last month',
    'dashboard.realtimeSales': 'Real-time Sales Feed',
    'dashboard.topCategories': 'Top Selling Categories',
    'dashboard.dailyRevenue': 'Daily Revenue Trends',
    'dashboard.thisWeek': 'This Week',
    'dashboard.avgDailyRevenue': 'Avg Daily Revenue',
    'dashboard.totalOrders': 'Total Orders',
    'dashboard.bestDay': 'Best Day',
    'dashboard.processedBy': 'Processed by Cashier Rahul',
    'dashboard.minsAgo': 'mins ago',

    // Categories
    'category.all': '🍽️ All Menu',
    'category.special': '⭐ Special',
    'category.soups': '🍲 Soups',
    'category.desserts': '🍰 Desserts',
    'category.chickens': '🍗 Chickens',

    // Menu
    'menu.title': 'Foodies Menu',
    'menu.outOfStock': '❌ Out of Stock',
    'menu.left': 'left',
    'menu.items': 'items',

    // Cart
    'cart.title': 'Cart',
    'cart.table': 'Table No',
    'cart.order': 'Order',
    'cart.people': 'People',
    'cart.clear': 'Clear cart',
    'cart.empty': 'No items in cart',
    'cart.orderedItems': 'Ordered Items',
    'cart.qty': 'Qty',
    'cart.total': 'Total',

    // Payment
    'payment.summary': 'Payment Summary',
    'payment.subtotal': 'Subtotal',
    'payment.tax': 'Tax',
    'payment.donation': 'Donation',
    'payment.total': 'Total Payable',
    'payment.totalPayable': 'Total Payable',
    'payment.method': 'Payment Method',
    'payment.cash': 'Cash',
    'payment.card': 'Card',
    'payment.scan': 'Scan',
    'payment.print': 'Print',
    'payment.checkout': 'Checkout',
    'payment.placeOrder': 'Place Order',

    // Receipt
    'receipt.title': 'Receipt Preview',
    'receipt.thankYou': 'Thank you for your visit!',
    'receipt.comeAgain': 'Please come again',
    'receipt.print': 'Print Receipt',

    // Inventory
    'inventory.title': 'Inventory',
    'inventory.subtitle': 'Manage your products and stock levels',
    'inventory.addProduct': 'Add Product',
    'inventory.totalProducts': 'Total Products',
    'inventory.inStock': 'In Stock',
    'inventory.lowStock': 'Low Stock',
    'inventory.outOfStock': 'Out of Stock',
    'inventory.searchPlaceholder': 'Search by name or SKU...',
    'inventory.product': 'Product',
    'inventory.sku': 'SKU',
    'inventory.category': 'Category',
    'inventory.price': 'Price',
    'inventory.stock': 'Stock',
    'inventory.status': 'Status',
    'inventory.actions': 'Actions',
    'inventory.min': 'Min',
    'inventory.restock': 'Restock',
    'inventory.edit': 'Edit',
    'inventory.delete': 'Delete',
    'inventory.addNewProduct': 'Add New Product',
    'inventory.enterProductDetails': 'Enter the product details below.',
    'inventory.productName': 'Product Name',
    'inventory.enterProductName': 'Enter product name',
    'inventory.enterSku': 'e.g., LUN-001',
    'inventory.minStock': 'Min Stock',
    'inventory.cancel': 'Cancel',
    'inventory.add': 'Add Product',
    'inventory.update': 'Update Product',
    'inventory.editProduct': 'Edit Product',
    'inventory.updateProduct': 'Update Product',
    'inventory.productAdded': 'has been added to inventory.',
    'inventory.productUpdated': 'has been updated.',
    'inventory.productDeleted': 'has been removed from inventory.',
    'inventory.missingFields': 'Missing fields',
    'inventory.fillRequired': 'Please fill in all required fields.',
    'inventory.productImage': 'Product Image',
    'inventory.bulkImport': 'Bulk Import',
    'inventory.importResult': 'Import Result',
    'inventory.importFailed': 'Import Failed',
    'inventory.someRowsFailed': 'Some rows failed',
    'inventory.errorsOccurred': 'Errors occurred',
    'inventory.importSuccessMsg': 'Download the template or upload your product CSV file.',
    'inventory.importErrorMsg': 'Failed to import some rows. See details below.',
    'inventory.errorDetails': 'Error Details',
    'inventory.uploadFile': 'Upload File',
    'inventory.exampleFile': 'Example File',

    // Customers
    'customers.title': 'Customers',
    'customers.subtitle': 'Manage your customer relationships',
    'customers.addCustomer': 'Add Customer',
    'customers.totalCustomers': 'Total Customers',
    'customers.active': 'Active',
    'customers.inactive': 'Inactive',
    'customers.totalRevenue': 'Total Revenue',
    'customers.searchPlaceholder': 'Search by name, email or phone...',
    'customers.joined': 'Joined',
    'customers.allTime': 'All time',
    'customers.activeCustomers': 'Active customers',
    'customers.noRecentOrders': 'No recent orders',
    'customers.fromAllCustomers': 'From all customers',
    'customers.addNewCustomer': 'Add New Customer',
    'customers.enterCustomerDetails': 'Enter customer details below.',
    'customers.fullName': 'Full Name',
    'customers.enterFullName': 'Enter full name',
    'customers.email': 'Email',
    'customers.enterEmail': 'Enter email address',
    'customers.phone': 'Phone Number',
    'customers.enterPhone': 'Enter phone number',
    'customers.editCustomer': 'Edit Customer',
    'customers.updateCustomer': 'Update Customer',
    'customers.customerAdded': 'has been added.',
    'customers.customerUpdated': 'details have been updated.',
    'customers.customerDeleted': 'has been removed.',

    // Reports
    'reports.title': 'Reports',
    'reports.subtitle': 'Sales analytics and insights',
    'reports.totalRevenue': 'Total Revenue',
    'reports.totalOrders': 'Total Orders',
    'reports.totalCustomers': 'Total Customers',
    'reports.avgOrderValue': 'Avg Order Value',
    'reports.profitMargin': 'Profit Margin',
    'reports.fromLastPeriod': 'from last period',
    'reports.salesOverview': 'Sales Overview',
    'reports.salesByCategory': 'Sales by Category',
    'reports.topProducts': 'Top Products',
    'reports.dailyBreakdown': 'Daily Sales Breakdown',
    'reports.day': 'Day',
    'reports.sales': 'Sales',
    'reports.customers': 'Customers',
    'reports.orders': 'Orders',
    'reports.export': 'Export',
    'reports.today': 'Today',
    'reports.thisWeek': 'This Week',
    'reports.thisMonth': 'This Month',
    'reports.thisYear': 'This Year',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your store settings and preferences',
    'settings.storeInfo': 'Store Information',
    'settings.updateStoreDetails': 'Update your store details',
    'settings.storeName': 'Store Name',
    'settings.storeAddress': 'Store Address',
    'settings.contactNumber': 'Contact Number',
    'settings.email': 'Email',
    'settings.notifications': 'Notifications',
    'settings.configureNotifications': 'Configure notification preferences',
    'settings.lowStockAlerts': 'Low Stock Alerts',
    'settings.lowStockDesc': 'Get notified when items run low',
    'settings.dailySalesSummary': 'Daily Sales Summary',
    'settings.dailySalesDesc': 'Receive daily sales reports via email',
    'settings.newCustomerAlerts': 'New Customer Alerts',
    'settings.newCustomerDesc': 'Get notified when new customers register',
    'settings.paymentSettings': 'Payment Settings',
    'settings.configurePayment': 'Configure payment options',
    'settings.defaultCurrency': 'Default Currency',
    'settings.taxRate': 'Tax Rate (GST)',
    'settings.appearance': 'Appearance',
    'settings.customizeLook': 'Customize the look and feel',
    'settings.theme': 'Theme',
    'settings.itemsPerPage': 'Items per page',
    'settings.saveChanges': 'Save Changes',
    'settings.saved': 'Settings saved',
    'settings.preferencesUpdated': 'Your preferences have been updated successfully.',
    'settings.themeChanged': 'Theme changed',
    'settings.switchedTo': 'Switched to',
    'settings.currentTheme': 'Current theme',
    'settings.light': 'Light',
    'settings.dark': 'Dark',

    // Messages
    'msg.cartEmpty': 'Cart is empty',
    'msg.cartEmptyDesc': 'Please add items to proceed with payment.',
    'msg.addedToCart': 'Added to cart',
    'msg.removed': 'Item removed',
    'msg.cleared': 'Cart cleared',
    'msg.paymentSuccess': 'Payment successful',
    'msg.orderPlaced': 'Order has been placed successfully.',
    'msg.outOfStock': 'Out of Stock',
    'msg.cannotAddMore': 'Cannot add more',
    'msg.stockRestored': 'Stock restored',
    'msg.invalidQuantity': 'Invalid quantity',
    'msg.enterValidQuantity': 'Please enter a valid quantity.',
  },
  
  // Urdu
  ur: {
    'app.title': 'ٹیسٹی اسٹیشن',
    'app.name': 'ایلیٹس پوس',
    'pos.terminal': 'پوس ٹرمینل',
    'lang.en': 'English',
    'lang.ur': 'اردو',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.posTerminal': 'پوس ٹرمینل',
    'nav.inventory': 'انوینٹری',
    'nav.customers': 'کسٹمرز',
    'nav.reports': 'رپورٹس',
    'nav.settings': 'سیٹنگز',
    'nav.signOut': 'سائن آؤٹ',

    'header.search': 'مینو، آرڈرز اور مزید تلاش کریں',
    'header.search.mobile': 'مینو تلاش کریں...',

    // Dashboard
    'dashboard.title': 'ڈیش بورڈ',
    'dashboard.welcome': 'خوش آمدید، ایڈمن۔ آج کی کارکردگی دیکھیں۔',
    'dashboard.totalRevenue': 'کل آمدنی',
    'dashboard.salesCount': 'فروخت کی تعداد',
    'dashboard.activeCustomers': 'فعال کسٹمرز',
    'dashboard.lowStock': 'کم اسٹاک اشیاء',
    'dashboard.fromLastMonth': 'پچھلے مہینے سے',
    'dashboard.realtimeSales': 'حقیقی وقت کی فروخت',
    'dashboard.topCategories': 'اعلیٰ زمرے',
    'dashboard.dailyRevenue': 'روزانہ آمدنی کا رجحان',
    'dashboard.thisWeek': 'اس ہفتے',
    'dashboard.avgDailyRevenue': 'اوسط روزانہ آمدنی',
    'dashboard.totalOrders': 'کل آرڈرز',
    'dashboard.bestDay': 'بہترین دن',
    'dashboard.processedBy': 'کیئیر راہول نے پروسیس کیا',
    'dashboard.minsAgo': 'منٹ پہلے',

    // Categories
    'category.all': '🍽️ تمام مینو',
    'category.special': '⭐ خاص',
    'category.soups': '🍲 سوپ',
    'category.desserts': '🍰 مٹھائیاں',
    'category.chickens': '🍗 چکن',

    // Menu
    'menu.title': 'فوڈیز مینو',
    'menu.outOfStock': '❌ اسٹاک ختم',
    'menu.left': 'باقی',
    'menu.items': 'اشیاء',

    // Cart
    'cart.title': 'کارٹ',
    'cart.table': 'ٹیبل نمبر',
    'cart.order': 'آرڈر',
    'cart.people': 'لوگ',
    'cart.clear': 'کارٹ صاف کریں',
    'cart.empty': 'کارٹ خالی ہے',
    'cart.orderedItems': 'آرڈر شدہ اشیاء',
    'cart.qty': 'تعداد',
    'cart.total': 'کل',

    // Payment
    'payment.summary': 'ادائیگی کا خلاصہ',
    'payment.subtotal': 'سب ٹوٹل',
    'payment.tax': 'ٹیکس',
    'payment.donation': 'عطیہ',
    'payment.total': 'کل ادائیگی',
    'payment.totalPayable': 'کل ادائیگی',
    'payment.method': 'ادائیگی کا طریقہ',
    'payment.cash': 'نقد',
    'payment.card': 'کارڈ',
    'payment.scan': 'اسکین',
    'payment.print': 'پرنٹ',
    'payment.checkout': 'چیک آؤٹ',
    'payment.placeOrder': 'آرڈر دیں',

    // Receipt
    'receipt.title': 'رسید کا پیش منظر',
    'receipt.thankYou': 'آپ کی آمد کا شکریہ!',
    'receipt.comeAgain': 'براہ کرم دوبارہ تشریف لائیں',
    'receipt.print': 'رسید پرنٹ کریں',

    // Inventory
    'inventory.title': 'انوینٹری',
    'inventory.subtitle': 'اپنی مصنوعات اور اسٹاک کا نظم کریں',
    'inventory.addProduct': 'مصنوعہ شامل کریں',
    'inventory.totalProducts': 'کل مصنوعات',
    'inventory.inStock': 'اسٹاک میں',
    'inventory.lowStock': 'کم اسٹاک',
    'inventory.outOfStock': 'اسٹاک ختم',
    'inventory.searchPlaceholder': 'نام یا SKU سے تلاش کریں...',
    'inventory.product': 'مصنوعہ',
    'inventory.sku': 'SKU',
    'inventory.category': 'زمرہ',
    'inventory.price': 'قیمت',
    'inventory.stock': 'اسٹاک',
    'inventory.status': 'حالت',
    'inventory.actions': 'عمل',
    'inventory.min': 'کم از کم',
    'inventory.restock': 'دوبارہ اسٹاک',
    'inventory.edit': 'ترمیم',
    'inventory.delete': 'حذف',
    'inventory.addNewProduct': 'نیا مصنوعہ شامل کریں',
    'inventory.enterProductDetails': 'نیچے مصنوعہ کی تفصیلات درج کریں۔',
    'inventory.productName': 'مصنوعہ کا نام',
    'inventory.enterProductName': 'مصنوعہ کا نام درج کریں',
    'inventory.enterSku': 'جیسے، LUN-001',
    'inventory.minStock': 'کم از کم اسٹاک',
    'inventory.cancel': 'منسوخ',
    'inventory.add': 'مصنوعہ شامل کریں',
    'inventory.update': 'مصنوعہ اپ ڈیٹ',
    'inventory.editProduct': 'مصنوعہ میں ترمیم',
    'inventory.updateProduct': 'مصنوعہ اپ ڈیٹ کریں',
    'inventory.productAdded': 'انوینٹری میں شامل ہو گیا۔',
    'inventory.productUpdated': 'اپ ڈیٹ ہو گیا۔',
    'inventory.productDeleted': 'انوینٹری سے ہٹا دیا گیا۔',
    'inventory.missingFields': 'خانہ خالی ہے',
    'inventory.fillRequired': 'براہ کرم تمام ضروری خانے پُر کریں۔',
    'inventory.productImage': 'پروڈکٹ کی تصویر',
    'inventory.bulkImport': 'بلک امپورٹ',
    'inventory.importResult': 'امپورٹ کا نتیجہ',
    'inventory.importFailed': 'امپورٹ ناکام',
    'inventory.someRowsFailed': 'کچھ لائنیں ناکام ہوئیں',
    'inventory.errorsOccurred': 'غلطیاں پیش آئیں',
    'inventory.importSuccessMsg': 'ٹیمپلیٹ ڈاؤن لوڈ کریں یا اپنی پروڈکٹ CSV فائل اپ لوڈ کریں۔',
    'inventory.importErrorMsg': 'کچھ لائنیں امپورٹ نہیں ہو سکیں۔ تفصیلات نیچے دیکھیں۔',
    'inventory.errorDetails': 'غلطی کی تفصیلات',
    'inventory.uploadFile': 'فائل اپ لوڈ کریں',
    'inventory.exampleFile': 'نمونہ فائل',

    // Customers
    'customers.title': 'کسٹمرز',
    'customers.subtitle': 'کسٹمر تعلقات کا نظم کریں',
    'customers.addCustomer': 'کسٹمر شامل کریں',
    'customers.totalCustomers': 'کل کسٹمرز',
    'customers.active': 'فعال',
    'customers.inactive': 'غیر فعال',
    'customers.totalRevenue': 'کل آمدنی',
    'customers.searchPlaceholder': 'نام، ای میل یا فون سے تلاش کریں...',
    'customers.joined': 'شامل ہوئے',
    'customers.allTime': 'کل',
    'customers.activeCustomers': 'فعال کسٹمرز',
    'customers.noRecentOrders': 'کوئی حالیہ آرڈر نہیں',
    'customers.fromAllCustomers': 'تمام کسٹمرز سے',
    'customers.addNewCustomer': 'نیا کسٹمر شامل کریں',
    'customers.enterCustomerDetails': 'نیچے کسٹمر کی تفصیلات درج کریں۔',
    'customers.fullName': 'پورا نام',
    'customers.enterFullName': 'پورا نام درج کریں',
    'customers.email': 'ای میل',
    'customers.enterEmail': 'ای میل ایڈریس درج کریں',
    'customers.phone': 'فون نمبر',
    'customers.enterPhone': 'فون نمبر درج کریں',
    'customers.editCustomer': 'کسٹمر میں ترمیم',
    'customers.updateCustomer': 'کسٹمر اپ ڈیٹ',
    'customers.customerAdded': 'شامل ہو گیا۔',
    'customers.customerUpdated': 'تفصیلات اپ ڈیٹ ہو گئیں۔',
    'customers.customerDeleted': 'ہٹا دیا گیا۔',

    // Reports
    'reports.title': 'رپورٹس',
    'reports.subtitle': 'فروخت کا تجزیہ اور بصیرت',
    'reports.totalRevenue': 'کل آمدنی',
    'reports.totalOrders': 'کل آرڈرز',
    'reports.totalCustomers': 'کل کسٹمرز',
    'reports.avgOrderValue': 'اوسط آرڈر ویلیو',
    'reports.profitMargin': 'منافع کا مارجن',
    'reports.fromLastPeriod': 'پچھلی مدت سے',
    'reports.salesOverview': 'فروخت کا جائزہ',
    'reports.salesByCategory': 'زمرہ وار فروخت',
    'reports.topProducts': 'اعلیٰ مصنوعات',
    'reports.dailyBreakdown': 'روزانہ فروخت کی تفصیل',
    'reports.day': 'دن',
    'reports.sales': 'فروخت',
    'reports.customers': 'کسٹمرز',
    'reports.orders': 'آرڈرز',
    'reports.export': 'ایکسپورٹ',
    'reports.today': 'آج',
    'reports.thisWeek': 'اس ہفتے',
    'reports.thisMonth': 'اس مہینے',
    'reports.thisYear': 'اس سال',

    // Settings
    'settings.title': 'سیٹنگز',
    'settings.subtitle': 'اسٹور سیٹنگز کا نظم کریں',
    'settings.storeInfo': 'اسٹور کی معلومات',
    'settings.updateStoreDetails': 'اسٹور کی تفصیلات اپ ڈیٹ کریں',
    'settings.storeName': 'اسٹور کا نام',
    'settings.storeAddress': 'اسٹور کا پتہ',
    'settings.contactNumber': 'رابطہ نمبر',
    'settings.email': 'ای میل',
    'settings.notifications': 'اطلاعات',
    'settings.configureNotifications': 'اطلاق کی ترجیحات مرتب کریں',
    'settings.lowStockAlerts': 'کم اسٹاک الرٹس',
    'settings.lowStockDesc': 'کم ہونے پر مطلع کریں',
    'settings.dailySalesSummary': 'روزانہ فروخت خلاصہ',
    'settings.dailySalesDesc': 'ای میل پر روزانہ فروخت رپورٹ وصول کریں',
    'settings.newCustomerAlerts': 'نئے کسٹمر الرٹس',
    'settings.newCustomerDesc': 'نئے کسٹمر شامل ہونے پر مطلع کریں',
    'settings.paymentSettings': 'ادائیگی کی سیٹنگز',
    'settings.configurePayment': 'ادائیگی کے اختیارات مرتب کریں',
    'settings.defaultCurrency': 'پہلے سے طے شدہ کرنسی',
    'settings.taxRate': 'ٹیکس کی شرح (GST)',
    'settings.appearance': 'ظاہری شکل',
    'settings.customizeLook': 'ظاہری شکل کو حسب ضرورت بنائیں',
    'settings.theme': 'تھیم',
    'settings.itemsPerPage': 'فی صفحہ اشیاء',
    'settings.saveChanges': 'تبدیلیاں محفوظ کریں',
    'settings.saved': 'سیٹنگز محفوظ ہو گئیں',
    'settings.preferencesUpdated': 'آپ کی ترجیحات کامیابی سے اپ ڈیٹ ہو گئیں۔',
    'settings.themeChanged': 'تھیم تبدیل ہو گئی',
    'settings.switchedTo': 'اس میں تبدیل',
    'settings.currentTheme': 'موجودہ تھیم',
    'settings.light': 'لائٹ',
    'settings.dark': 'ڈارک',

    // Messages
    'msg.cartEmpty': 'کارٹ خالی ہے',
    'msg.cartEmptyDesc': 'ادائیگی کے لیے براہ کرم اشیاء شامل کریں۔',
    'msg.addedToCart': 'کارٹ میں شامل',
    'msg.removed': 'آئٹم ہٹا دی گئی',
    'msg.cleared': 'کارٹ صاف ہو گیا',
    'msg.paymentSuccess': 'ادائیگی کامیاب',
    'msg.orderPlaced': 'آرڈر کامیابی سے دے دیا گیا۔',
    'msg.outOfStock': 'اسٹاک ختم',
    'msg.cannotAddMore': 'مزید شامل نہیں کر سکتے',
    'msg.stockRestored': 'اسٹاک بحال',
    'msg.invalidQuantity': 'غلط مقدار',
    'msg.enterValidQuantity': 'براہ کرم درست مقدار درج کریں۔',
  },
}
