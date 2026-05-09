"use client"

import * as React from "react"
import { Search, Plus, Edit, Trash2, AlertTriangle, Package, TrendingUp, TrendingDown, PackagePlus, Upload, Download, X, Loader2, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import ProtectedRoute from "@/components/protected-route"
import api from "@/lib/api"
import { AxiosError } from "axios"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Product {
  id: string
  name: string
  category: string
  price: number
  costPrice: number
  stock: number
  minStock: number
  sku: string
  barcode: string
  description: string
  unitType: string
  status: "in-stock" | "low-stock" | "out-of-stock"
  image?: string
}

function ComboInput({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [isFocused, setIsFocused] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // When focused: show query (search text), else show actual value
  const displayValue = isFocused ? query : (value || "")

  // Filter based on query when focused, show all when query is empty
  const filtered = query.trim() === ""
    ? options
    : options.filter(o => o.toLowerCase().includes(query.toLowerCase()))

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setIsFocused(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleFocus = () => {
    setIsFocused(true)
    setQuery("")        // clear search so full list shows
    setOpen(true)
    // select all text so user can immediately type to replace
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleInput = (val: string) => {
    setQuery(val)
    setOpen(true)
    // if user clears input, also clear the value
    if (val === "") onChange("")
  }

  const handleSelect = (opt: string) => {
    onChange(opt)
    setQuery("")
    setIsFocused(false)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setIsFocused(false); setQuery("") }
    if (e.key === "Enter" && filtered.length === 1) { handleSelect(filtered[0]); e.preventDefault() }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <Input
          ref={inputRef}
          value={displayValue}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={isFocused ? "Search or type..." : placeholder}
          className="rounded-r-none border-r-0 combo-field"
        />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
          className="border border-white rounded-r-md px-2.5 bg-background hover:bg-accent/10 transition-colors flex items-center"
        >
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(opt => (
            <div
              key={opt}
              onMouseDown={() => handleSelect(opt)}
              className={`combo-option px-3 py-2 text-sm cursor-pointer transition-all duration-150 ${opt === value ? "bg-accent/10 text-accent font-medium" : ""}`}
            >
              {opt}
              {opt === value && <span className="float-right text-accent text-xs">✓</span>}
            </div>
          )) : (
            <div className="px-3 py-2 text-sm text-muted-foreground italic">Press Enter to use "{query}"</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InventoryPage() {
  const { toast } = useToast()
  const { t, isRTL } = useLanguage()
  const [products, setProducts] = React.useState<Product[]>([])
  const [categories, setCategories] = React.useState<string[]>(["All"])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState("All")
  const [isAddOpen, setIsAddOpen] = React.useState(false)

  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [restockingProduct, setRestockingProduct] = React.useState<Product | null>(null)
  const [restockQuantity, setRestockQuantity] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [newProduct, setNewProduct] = React.useState<Partial<Product>>({
    name: "",
    category: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    minStock: 10,
    sku: "",
    barcode: "",
    description: "",
    unitType: "pcs",
    image: "",
  })
  
  // Separate string states for numeric inputs to allow empty typing
  const [numInputs, setNumInputs] = React.useState({
    price: "0",
    costPrice: "0",
    stock: "0",
    minStock: "10"
  })

  const [productImage, setProductImage] = React.useState<string>("")
  const [saving, setSaving] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const res = await api.get("/products")
      const data = res.data.data || []
      const mapped = data.map((p: any) => ({
        id: p.id?.toString() || "",
        name: p.name || "",
        category: p.category || "",
        price: p.selling_price != null ? parseFloat(p.selling_price) : 0,
        costPrice: p.cost_price != null ? parseFloat(p.cost_price) : 0,
        stock: p.stock != null ? parseInt(p.stock) : 0,
        minStock: p.threshold != null ? parseInt(p.threshold) : 10,
        sku: p.sku || "",
        barcode: p.barcode || "",
        description: p.description || "",
        unitType: p.unit_type || "pcs",
        image: p.image || "",
        status: getStatus(p.stock != null ? parseInt(p.stock) : 0, p.threshold != null ? parseInt(p.threshold) : 10),
      }))
      setProducts(mapped)
      const cats = [...new Set(mapped.map((p: Product) => p.category).filter(Boolean))] as string[]
      setCategories(["All", ...cats])
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load products",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [importResult, setImportResult] = React.useState<{
    success: boolean;
    message: string;
    totalRows: number;
    errors: string[] | null;
  } | null>(null);

  const downloadExampleCSV = () => {
    const csvHeader = "id,name,category,sku,barcode,description,selling_price,cost_price,stock,threshold,unit_type,created_at,image\n";
    const csvRows = [
      "1,Sample Product A,Electronics,SKU001,1234567890123,Basic electronic item,1500,1200,50,10,pcs,2026-01-01,https://example.com/image1.jpg",
      "2,Sample Product B,Groceries,SKU002,1234567890124,Daily grocery item,200,150,100,20,pcs,2026-01-02,https://example.com/image2.jpg",
      "3,Sample Product C,Clothing,SKU003,1234567890125,Casual wear item,2500,1800,30,5,pcs,2026-01-03,https://example.com/image3.jpg",
      "4,Sample Product D,Stationery,SKU004,1234567890126,Office stationery item,300,200,200,50,pcs,2026-01-04,https://example.com/image4.jpg",
      "5,Sample Product E,Home Decor,SKU005,1234567890127,Decorative item,1200,900,20,5,pcs,2026-01-05,https://example.com/image5.jpg"
    ].join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + csvHeader + csvRows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      setIsImporting(true)
      const res = await api.post('/products/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data.success) {
        setImportResult({
          success: true,
          message: res.data.message,
          totalRows: res.data.totalRows,
          errors: res.data.errors
        })
        setIsImportOpen(false)
        fetchProducts()
      } else {
        setImportResult({
          success: false,
          message: res.data.message || "Import failed",
          totalRows: 0,
          errors: res.data.errors || ["Unknown error occurred"]
        })
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        message: "Import failed due to a server error",
        totalRows: 0,
        errors: [err.response?.data?.message || err.message || "An error occurred during import"]
      })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Load from backend API on mount
  React.useEffect(() => {
    fetchProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getStatus = (stock: number, minStock: number): Product["status"] => {
    if (stock <= 0) return "out-of-stock"
    if (stock <= minStock) return "low-stock"
    return "in-stock"
  }

  const stats = {
    total: products.length,
    inStock: products.filter(p => p.status === "in-stock").length,
    lowStock: products.filter(p => p.status === "low-stock").length,
    outOfStock: products.filter(p => p.status === "out-of-stock").length,
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleAddProduct = async () => {
    if (!newProduct.name) {
      toast({ title: "Missing fields", description: "Product name is required.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const sellingPrice = parseFloat(numInputs.price);
      const costPrice = parseFloat(numInputs.costPrice);
      const stockValue = parseInt(numInputs.stock);
      const thresholdValue = parseInt(numInputs.minStock);

      const res = await api.post("/products", {
        name: newProduct.name,
        category: newProduct.category || "",
        sku: newProduct.sku || "",
        barcode: newProduct.barcode || "",
        description: newProduct.description || "",
        selling_price: isNaN(sellingPrice) ? 0 : sellingPrice,
        cost_price: isNaN(costPrice) ? 0 : costPrice,
        stock: isNaN(stockValue) ? 0 : stockValue,
        threshold: isNaN(thresholdValue) ? 10 : thresholdValue,
        unit_type: newProduct.unitType || "pcs",
        image: newProduct.image || "",
      })
      const backendProduct = res.data.data
      const product: Product = {
        id: backendProduct.id.toString(),
        name: backendProduct.name || "",
        category: backendProduct.category || "",
        price: backendProduct.selling_price != null ? parseFloat(backendProduct.selling_price) : 0,
        costPrice: backendProduct.cost_price != null ? parseFloat(backendProduct.cost_price) : 0,
        stock: backendProduct.stock != null ? parseInt(backendProduct.stock) : 0,
        minStock: backendProduct.threshold != null ? parseInt(backendProduct.threshold) : 10,
        sku: backendProduct.sku || "",
        barcode: backendProduct.barcode || "",
        description: backendProduct.description || "",
        unitType: backendProduct.unit_type || "pcs",
        image: backendProduct.image || "",
        status: getStatus(backendProduct.stock != null ? parseInt(backendProduct.stock) : 0, backendProduct.threshold != null ? parseInt(backendProduct.threshold) : 10),
      }
      const updated = [...products, product]
      setProducts(updated)
      if (product.category && !categories.includes(product.category)) {
        setCategories(prev => [...prev, product.category])
      }
      setIsAddOpen(false)
      setNewProduct({ name: "", category: "", price: 0, costPrice: 0, stock: 0, minStock: 10, sku: "", barcode: "", description: "", unitType: "pcs", image: "" })
      setNumInputs({
        price: "0",
        costPrice: "0",
        stock: "0",
        minStock: "10"
      })
      setProductImage("")
      toast({ title: "Product added", description: `${product.name} has been added to inventory.` })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      const errorMessage = error.response?.data?.message || error.message || "Failed to add product"
      console.error('Add product error:', error)
      toast({ 
        title: "Error Adding Product", 
        description: errorMessage, 
        variant: "destructive" 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" })
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setProductImage(result)
        setNewProduct(prev => ({ ...prev, image: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setProductImage("")
    setNewProduct(prev => ({ ...prev, image: "" }))
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    setSaving(true)
    try {
      const res = await api.put(`/products/${editingProduct.id}`, {
        name: editingProduct.name,
        category: editingProduct.category,
        sku: editingProduct.sku,
        barcode: editingProduct.barcode,
        description: editingProduct.description,
        selling_price: editingProduct.price,
        cost_price: editingProduct.costPrice,
        stock: editingProduct.stock,
        threshold: editingProduct.minStock,
        unit_type: editingProduct.unitType,
        image: editingProduct.image || "",
      })
      const backendProduct = res.data.data
      const updated = products.map(p =>
        p.id === backendProduct.id.toString()
          ? {
              ...p,
              name: backendProduct.name || "",
              category: backendProduct.category || "",
              price: backendProduct.selling_price != null ? parseFloat(backendProduct.selling_price) : 0,
              costPrice: backendProduct.cost_price != null ? parseFloat(backendProduct.cost_price) : 0,
              stock: backendProduct.stock != null ? parseInt(backendProduct.stock) : 0,
              minStock: backendProduct.threshold != null ? parseInt(backendProduct.threshold) : 10,
              sku: backendProduct.sku || "",
              barcode: backendProduct.barcode || "",
              description: backendProduct.description || "",
              unitType: backendProduct.unit_type || "pcs",
              image: backendProduct.image || "",
              status: getStatus(backendProduct.stock != null ? parseInt(backendProduct.stock) : 0, backendProduct.threshold != null ? parseInt(backendProduct.threshold) : 10),
            }
          : p
      )
      setProducts(updated)
      setEditingProduct(null)
      toast({ title: "Product updated", description: `${backendProduct.name} has been updated.` })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to update product", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    try {
      await api.delete(`/products/${id}`)
      const updated = products.filter(p => p.id !== id)
      setProducts(updated)
      toast({ title: "Product deleted", description: `${name} has been removed from inventory.`, variant: "destructive" })
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to delete product", variant: "destructive" })
    }
  }

  const handleRestockProduct = async () => {
    if (!restockingProduct || restockQuantity <= 0) {
      toast({ title: "Invalid quantity", description: "Please enter a valid quantity.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const newStock = restockingProduct.stock + restockQuantity
      await api.put(`/products/${restockingProduct.id}`, { stock: newStock })
      const updated = products.map(p => {
        if (p.id === restockingProduct.id) {
          return { ...p, stock: newStock, status: getStatus(newStock, p.minStock) }
        }
        return p
      })
      setProducts(updated)
      toast({ title: "Product restocked", description: `${restockQuantity} units of ${restockingProduct.name} added to stock.` })
      setRestockingProduct(null)
      setRestockQuantity(0)
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>
      toast({ title: "Error", description: error.response?.data?.message || "Failed to restock product", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const quickRestockAmounts = [10, 25, 50, 100]

  const getStatusBadge = (status: Product["status"]) => {
    switch (status) {
      case "in-stock": return <Badge className="bg-green-500 text-white">In Stock</Badge>
      case "low-stock": return <Badge className="bg-orange-500 text-white">Low Stock</Badge>
      case "out-of-stock": return <Badge className="bg-red-500 text-white">Out of Stock</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex flex-col gap-1">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">{t('inventory.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBulkImport}
            accept=".csv"
            className="hidden"
          />
          <Button 
            variant="outline" 
            onClick={() => setIsImportOpen(true)} 
            disabled={isImporting}
            className="gap-2 flex-1 sm:flex-none"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Bulk Import</span>
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 flex-1 sm:flex-none">
            <Plus className="w-4 h-4" />
            <span>{t('inventory.addProduct')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('inventory.totalProducts')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('inventory.inStock')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold text-green-500">{stats.inStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('inventory.lowStock')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold text-orange-500">{stats.lowStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t('inventory.outOfStock')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-xl sm:text-2xl font-bold text-red-500">{stats.outOfStock}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('inventory.searchPlaceholder')} className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder={t('inventory.category')} /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader><CardTitle>{t('inventory.totalProducts')} ({filteredProducts.length})</CardTitle></CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No products found. Add your first product!</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border">
                <div className="grid grid-cols-9 gap-4 p-4 bg-muted/50 font-medium text-sm">
                  <div className="col-span-2">{t('inventory.product')}</div>
                  <div>{t('inventory.sku')}</div>
                  <div>{t('inventory.category')}</div>
                  <div>{t('inventory.price')}</div>
                  <div>{t('inventory.stock')}</div>
                  <div>{t('inventory.status')}</div>
                  <div className="col-span-2">{t('inventory.actions')}</div>
                </div>
                <div className="divide-y">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="grid grid-cols-9 gap-4 p-4 items-center hover:bg-muted/30 transition-colors">
                      <div className="col-span-2">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">Min: {product.minStock}</p>
                      </div>
                      <div className="text-sm font-mono">{product.sku}</div>
                      <div><Badge variant="secondary">{product.category}</Badge></div>
                      <div className="font-semibold">Rs. {product.price.toFixed(2)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${product.stock <= product.minStock ? 'text-red-500' : ''}`}>{product.stock}</span>
                          {product.stock <= product.minStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                        </div>
                      </div>
                      <div>{getStatusBadge(product.status)}</div>
                      <div className="col-span-2 flex gap-2">
                        {product.status === "out-of-stock" ? (
                          <Button variant="default" size="sm" onClick={() => { setRestockingProduct(product); setRestockQuantity(10) }} className="bg-green-600 hover:bg-green-700">
                            <PackagePlus className="w-4 h-4" /><span className="ml-1">{t('inventory.restock')}</span>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setEditingProduct(product)}><Edit className="w-4 h-4" /></Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product.id, product.name)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="border border-white rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      {getStatusBadge(product.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Category</p>
                        <Badge variant="secondary">{product.category}</Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Price</p>
                        <p className="font-semibold">Rs. {product.price.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Stock</p>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${product.stock <= product.minStock ? 'text-red-500' : ''}`}>{product.stock}</span>
                          {product.stock <= product.minStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground">Min: {product.minStock}</p>
                      </div>
                      <div className="flex items-end justify-end">
                        <div className="flex gap-2">
                          {product.status === "out-of-stock" ? (
                            <Button variant="default" size="sm" onClick={() => { setRestockingProduct(product); setRestockQuantity(10) }} className="bg-green-600 hover:bg-green-700">
                              <PackagePlus className="w-4 h-4" /><span className="ml-1">{t('inventory.restock')}</span>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setEditingProduct(product)}><Edit className="w-4 h-4" /><span className="ml-1">{t('inventory.edit')}</span></Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product.id, product.name)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /><span className="ml-1">{t('inventory.delete')}</span></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-h-[unset]">
          <DialogHeader>
            <DialogTitle>{t('inventory.addNewProduct')}</DialogTitle>
            <DialogDescription>{t('inventory.enterProductDetails')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('inventory.productName')}</Label>
              <Input id="name" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder={t('inventory.enterProductName')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sku">{t('inventory.sku')} <span className="text-xs text-muted-foreground">(Category se auto-generate)</span></Label>
                <Input id="sku" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="Category select karo..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" value={newProduct.barcode} onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })} placeholder="Scan or enter barcode" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">{t('inventory.category')}</Label>
              <ComboInput
                value={newProduct.category || ""}
                onChange={async (value) => {
                  setNewProduct({ ...newProduct, category: value })
                  if (value) {
                    try {
                      const res = await api.get(`/products/generate-sku?category=${encodeURIComponent(value)}`)
                      if (res.data.success) {
                        setNewProduct(prev => ({ ...prev, category: value, sku: res.data.sku }))
                      }
                    } catch {}
                  }
                }}
                options={categories.filter(c => c !== "All")}
                placeholder="Select or type category"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Selling Price</Label>
                <Input id="price" type="number" step="0.01" value={numInputs.price} onChange={(e) => setNumInputs({ ...numInputs, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="costPrice">Cost Price</Label>
                <Input id="costPrice" type="number" step="0.01" value={numInputs.costPrice} onChange={(e) => setNumInputs({ ...numInputs, costPrice: e.target.value })} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock">Stock</Label>
                <Input id="stock" type="number" value={numInputs.stock} onChange={(e) => setNumInputs({ ...numInputs, stock: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minStock">{t('inventory.minStock')}</Label>
                <Input id="minStock" type="number" value={numInputs.minStock} onChange={(e) => setNumInputs({ ...numInputs, minStock: e.target.value })} placeholder="10" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unitType">Unit Type</Label>
                <ComboInput
                  value={newProduct.unitType || ""}
                  onChange={(value) => setNewProduct({ ...newProduct, unitType: value })}
                  options={["Pieces (pcs)", "Kilograms (kg)", "Grams (g)", "Liters (l)", "Milliliters (ml)", "Meters (m)", "Boxes (box)", "Dozen", "Pair"]}
                  placeholder="Select or type unit"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Product Image</Label>
                <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full border border-white">MAX 5MB</span>
              </div>
              {productImage ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-white">
                  <img src={productImage} alt="Product" className="w-full h-full object-cover" />
                  <button type="button" onClick={removeImage} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-white rounded-lg p-6 hover:border-white/50 transition-colors cursor-pointer group">
                  <label htmlFor="product-image" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground font-medium">Click to upload image</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">Supports: JPG, PNG, WEBP (Max 5MB)</p>
                      </div>
                    </div>
                    <Input id="product-image" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={saving} className="w-full sm:w-auto">{t('inventory.cancel')}</Button>
            <Button onClick={handleAddProduct} disabled={saving} className="w-full sm:w-auto">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : t('inventory.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-h-[unset]">
          <DialogHeader>
            <DialogTitle>{t('inventory.editProduct')}</DialogTitle>
            <DialogDescription>{t('inventory.updateProduct')}</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Product Name</Label>
                <Input value={editingProduct.name ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>SKU</Label>
                  <Input value={editingProduct.sku ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Barcode</Label>
                  <Input value={editingProduct.barcode ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })} placeholder="Scan or enter barcode" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={editingProduct.category ?? ""}
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c !== "All").map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Price</Label>
                  <Input type="number" value={editingProduct.price ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>Stock</Label>
                  <Input type="number" value={editingProduct.stock ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>Min Stock</Label>
                  <Input type="number" value={editingProduct.minStock ?? 10} onChange={(e) => setEditingProduct({ ...editingProduct, minStock: parseInt(e.target.value) || 10 })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Unit Type</Label>
                  <Select 
                    value={editingProduct.unitType || 'pcs'} 
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, unitType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="g">Grams (g)</SelectItem>
                      <SelectItem value="l">Liters (l)</SelectItem>
                      <SelectItem value="ml">Milliliters (ml)</SelectItem>
                      <SelectItem value="m">Meters (m)</SelectItem>
                      <SelectItem value="box">Boxes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingProduct(null)} disabled={saving} className="w-full sm:w-auto">{t('inventory.cancel')}</Button>
            <Button onClick={handleUpdateProduct} disabled={saving} className="w-full sm:w-auto">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : t('inventory.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={!!restockingProduct} onOpenChange={() => { setRestockingProduct(null); setRestockQuantity(0) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PackagePlus className="w-5 h-5 text-green-600" />{t('inventory.restock')}</DialogTitle>
            <DialogDescription>Restock <span className="font-semibold">{restockingProduct?.name}</span></DialogDescription>
          </DialogHeader>
          {restockingProduct && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Stock</span>
                  <span className="text-2xl font-bold text-red-600">{restockingProduct.stock}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quick Restock Amounts</Label>
                <div className="grid grid-cols-4 gap-2">
                  {quickRestockAmounts.map(amount => (
                    <Button key={amount} variant="outline" size="sm" onClick={() => setRestockQuantity(amount)} className={restockQuantity === amount ? "border-white bg-green-50 dark:bg-green-950" : ""}>{amount}</Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Custom Quantity</Label>
                <Input type="number" value={restockQuantity} onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)} className="text-lg" />
              </div>
              {restockQuantity > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">New Stock Will Be</span>
                    <span className="text-2xl font-bold text-green-600">{restockingProduct.stock + restockQuantity}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setRestockingProduct(null); setRestockQuantity(0) }} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleRestockProduct} className="w-full sm:w-auto bg-green-600 hover:bg-green-700"><PackagePlus className="w-4 h-4 mr-2" />Confirm Restock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-primary" />{t('inventory.bulkImport')}</DialogTitle>
            <DialogDescription>{t('inventory.importSuccessMsg')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white rounded-xl bg-muted/10">
              <Package className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm text-center text-muted-foreground mb-6">
                Please use our CSV template to ensure your product data is formatted correctly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <Button variant="outline" onClick={downloadExampleCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  {t('inventory.exampleFile')}
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBulkImport}
                    accept=".csv"
                    className="hidden"
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isImporting}
                    className="gap-2 w-full bg-primary hover:bg-primary/90"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t('inventory.uploadFile')}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Required Columns:</p>
              <div className="flex flex-wrap gap-1">
                {['name', 'category', 'sku', 'selling_price', 'cost_price', 'stock'].map(col => (
                  <Badge key={col} variant="secondary" className="text-[10px] py-0">{col}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsImportOpen(false)} className="w-full sm:w-auto">{t('inventory.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Result Summary Dialog */}
      <Dialog open={!!importResult} onOpenChange={(open) => !open && setImportResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {!importResult?.success ? (
                <X className="w-5 h-5 text-destructive" />
              ) : importResult?.errors && importResult.errors.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              ) : (
                <Package className="w-5 h-5 text-green-500" />
              )}
              {importResult?.success ? t('inventory.importResult') : t('inventory.importFailed')}
            </DialogTitle>
            <DialogDescription>
              {importResult?.message}
            </DialogDescription>
          </DialogHeader>
          
          {importResult?.errors && importResult.errors.length > 0 && (
            <div className="space-y-4">
              <Alert variant={importResult.success ? "default" : "destructive"} className={importResult.success ? "bg-orange-500/10 text-orange-600 border-white" : "bg-destructive/10 text-destructive border-white/20"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{importResult.success ? t('inventory.someRowsFailed') : t('inventory.errorsOccurred')}</AlertTitle>
                <AlertDescription>
                  {importResult.success ? `${importResult.errors.length} rows could not be imported due to errors (e.g., duplicate SKUs).` : t('inventory.importErrorMsg')}
                </AlertDescription>
              </Alert>
              
              <div className="text-sm font-medium">{t('inventory.errorDetails')}:</div>
              <ScrollArea className="h-[200px] w-full rounded-md border border-white p-4">
                <ul className="space-y-2">
                  {importResult.errors.map((err, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      {err}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setImportResult(null)} className="w-full" variant={importResult?.success ? "default" : "destructive"}>
              {t('inventory.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
    </ProtectedRoute>
  )
}
