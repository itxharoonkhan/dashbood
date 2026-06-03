"use client"

import * as React from "react"
import {
  Package,
  Tag,
  Barcode,
  DollarSign,
  Boxes,
  FileText,
  AlertTriangle,
  Hash,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface ProductFormData {
  name: string
  sku: string
  barcode: string
  category: string
  price: string
  cost: string
  stock: string
  threshold: string
  description: string
  unit_type: string
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingProduct?: any | null
}

const categories = [
  "Electronics",
  "Accessories",
  "Clothing",
  "Stationery",
  "Home & Living",
  "Food & Beverages",
  "Health & Beauty",
  "Others",
]

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function RequiredBadge() {
  return <span className="ml-1 text-destructive text-sm leading-none">*</span>
}

export function ProductFormDialog({ open, onOpenChange, editingProduct }: ProductFormDialogProps) {
  const { toast } = useToast()
  const [formData, setFormData] = React.useState<ProductFormData>({
    name: "",
    sku: "",
    barcode: "",
    category: "",
    price: "",
    cost: "",
    stock: "",
    threshold: "",
    description: "",
    unit_type: "pcs",
  })

  React.useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || "",
        sku: editingProduct.sku || "",
        barcode: editingProduct.barcode || "",
        category: editingProduct.category || "",
        price: editingProduct.price?.toString() || "",
        cost: editingProduct.cost?.toString() || "",
        stock: editingProduct.stock?.toString() || "",
        threshold: editingProduct.threshold?.toString() || "",
        description: editingProduct.description || "",
        unit_type: editingProduct.unit_type || "pcs",
      })
    } else {
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        category: "",
        price: "",
        cost: "",
        stock: "",
        threshold: "",
        description: "",
        unit_type: "pcs",
      })
    }
  }, [editingProduct, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.sku || !formData.price) {
      toast({
        title: "Validation Error",
        description: "Product Name, SKU, and Selling Price are required.",
        variant: "destructive",
      })
      return
    }
    toast({
      title: editingProduct ? "Product Updated" : "Product Added",
      description: `${formData.name} has been ${editingProduct ? "updated" : "added"} successfully.`,
    })
    onOpenChange(false)
  }

  const handleChange = (field: keyof ProductFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingProduct ? "Update product information below" : "Fill in the details to add a new product"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6">

            {/* Basic Info */}
            <div>
              <SectionHeader icon={Package} title="Basic Information" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Product Name <RequiredBadge />
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Wireless Mouse"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-sm font-medium">
                    Category <RequiredBadge />
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleChange("category", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Identifiers */}
            <div>
              <SectionHeader icon={Hash} title="Identifiers" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sku" className="text-sm font-medium">
                    SKU <RequiredBadge />
                  </Label>
                  <div className="relative">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="sku"
                      placeholder="e.g., WMS-001"
                      value={formData.sku}
                      onChange={(e) => handleChange("sku", e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="barcode" className="text-sm font-medium">
                    Barcode
                  </Label>
                  <div className="relative">
                    <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      id="barcode"
                      placeholder="Scan or enter barcode"
                      value={formData.barcode}
                      onChange={(e) => handleChange("barcode", e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <SectionHeader icon={DollarSign} title="Pricing" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Selling Price <RequiredBadge />
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      Rs
                    </span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => handleChange("price", e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cost" className="text-sm font-medium">
                    Cost Price
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      Rs
                    </span>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.cost}
                      onChange={(e) => handleChange("cost", e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Management */}
            <div>
              <SectionHeader icon={Boxes} title="Stock Management" />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stock" className="text-sm font-medium">
                    Current Stock
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => handleChange("stock", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="threshold" className="text-sm font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Low Stock Alert
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    placeholder="10"
                    value={formData.threshold}
                    onChange={(e) => handleChange("threshold", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit" className="text-sm font-medium">
                    Unit Type
                  </Label>
                  <Select
                    value={formData.unit_type}
                    onValueChange={(value) => handleChange("unit_type", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
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

            {/* Description */}
            <div>
              <SectionHeader icon={FileText} title="Additional Details" />
              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Optional product description..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            </div>

          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Fields marked <span className="text-destructive font-semibold">*</span> are required
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 px-5 bg-primary hover:bg-primary/90"
              >
                {editingProduct ? "Update Product" : "Add Product"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
