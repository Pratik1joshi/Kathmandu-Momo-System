'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import MenuItemImage from '@/components/menu-item-image';
import { Plus, Edit, Trash2, Search, Package, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { friendlyMessage, friendlyFromError } from '@/lib/friendly-message';
import FieldError, { inputErrorClass } from '@/components/ui/field-error';
import { numbersOnlyInput, validateName, validatePositiveNumber, firstError } from '@/lib/form-validation';

const emptyForm = {
  name: '',
  category_id: '',
  price: '',
  cost: '',
  description: '',
  image_url: '',
  is_available: true,
  is_vegetarian: false,
};

export default function ProductsPage() {
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  
  const [formData, setFormData] = useState({ ...emptyForm });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('pos_token');
      const response = await fetch('/api/admin/products', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('pos_token');
      const response = await fetch('/api/restaurant/menu/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = {
      name: validateName(formData.name, 'item name'),
      category_id: !formData.category_id ? 'Please choose a category.' : null,
      price: validatePositiveNumber(formData.price, 'price', { allowZero: false }),
      cost: formData.cost === '' || formData.cost == null
        ? null
        : validatePositiveNumber(formData.cost, 'cost', { allowZero: true }),
    };
    setFormErrors(nextErrors);
    const msg = firstError(nextErrors);
    if (msg) {
      addToast(friendlyMessage('validation', { description: msg }));
      return;
    }
    
    try {
      const token = localStorage.getItem('pos_token');
      const url = editingProduct 
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          cost: formData.cost === '' ? null : Number(formData.cost),
        })
      });

      if (response.ok) {
        fetchProducts();
        setShowForm(false);
        setEditingProduct(null);
        setFormData({ ...emptyForm });
        setFormErrors({});
        addToast(friendlyMessage('save_success', {
          description: editingProduct ? 'Menu item was updated.' : 'Menu item was added.',
        }));
      } else {
        const data = await response.json().catch(() => ({}));
        addToast(friendlyFromError(data, 'save_failed'));
      }
    } catch (error) {
      console.error('Error:', error);
      addToast(friendlyFromError(error, 'save_failed'));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const token = localStorage.getItem('pos_token');
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/uploads/menu', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, image_url: data.url || data.image_url }));
        addToast(friendlyMessage('save_success', { description: 'Image uploaded.' }));
      } else {
        const err = await response.json().catch(() => ({}));
        addToast(friendlyFromError(err, 'upload_failed'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      addToast(friendlyFromError(error, 'upload_failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category_id: product.category_id,
      price: product.price,
      cost: product.cost || '',
      description: product.description || '',
      image_url: product.image_url || '',
      is_available: !!product.is_available,
      is_vegetarian: !!product.is_vegetarian,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    
    try {
      const token = localStorage.getItem('pos_token');
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Live count per category, recomputed as products change
  const categoryCounts = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const key = String(p.category_id ?? '');
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [products]);

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      activeCategory === 'all' || String(p.category_id ?? '') === String(activeCategory);
    return matchesCategory && p.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Products Management</h1>
              <p className="text-gray-700 mt-1">Manage menu items and inventory</p>
            </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingProduct(null);
              setFormData({ ...emptyForm });
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-5 h-5" />
            <span>Add Menu Item</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-700 w-5 h-5" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-700 text-gray-900"
            />
          </div>

          {/* Category filter */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  String(activeCategory) === String(cat.id)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat.name} ({categoryCounts.get(String(cat.id)) || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Product Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingProduct ? 'Edit Menu Item' : 'Add New Menu Item'}
                </h2>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Item Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={inputErrorClass(!!formErrors.name, 'w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 text-gray-900')}
                  />
                  <FieldError message={formErrors.name} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    className={inputErrorClass(!!formErrors.category_id, 'w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 text-gray-900')}
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <FieldError message={formErrors.category_id} />
                </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Sale Price *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: numbersOnlyInput(e.target.value, { allowDecimal: true })})}
                      className={inputErrorClass(!!formErrors.price, 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 text-gray-900')}
                      placeholder="0"
                    />
                    <FieldError message={formErrors.price} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Cost Price</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.cost}
                      onChange={(e) => setFormData({...formData, cost: numbersOnlyInput(e.target.value, { allowDecimal: true })})}
                      className={inputErrorClass(!!formErrors.cost, 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 text-gray-900')}
                      placeholder="0"
                    />
                    <FieldError message={formErrors.cost} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Food Image</label>
                  <div className="flex items-center gap-4">
                    <MenuItemImage src={formData.image_url} alt={formData.name || 'Preview'} size="md" />
                    <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-800">
                      <Upload className="w-4 h-4" />
                      <span>{uploading ? 'Uploading…' : 'Upload image'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={uploading}
                        onChange={handleImageUpload}
                      />
                    </label>
                    {formData.image_url && (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_available}
                      onChange={(e) => setFormData({...formData, is_available: e.target.checked})}
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-400"
                    />
                    <span className="text-sm text-gray-700">Available</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_vegetarian}
                      onChange={(e) => setFormData({...formData, is_vegetarian: e.target.checked})}
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-400"
                    />
                    <span className="text-sm text-gray-700">Vegetarian</span>
                  </label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    {editingProduct ? 'Update' : 'Create'} Product
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduct(null);
                    }}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mobile product cards */}
        <div className="md:hidden space-y-3">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500">{product.category_name || '-'}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                    product.is_available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-3">Rs {product.price}</p>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(product)} className="flex-1 py-2 text-blue-600 bg-blue-50 rounded-lg text-sm font-semibold">Edit</button>
                  <button onClick={() => handleDelete(product.id)} className="flex-1 py-2 text-red-600 bg-red-50 rounded-lg text-sm font-semibold">Delete</button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl p-10 text-center text-gray-500">No menu items found</div>
          )}
        </div>

        {/* Desktop products table */}
        <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Image</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Product</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Category</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Price</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <MenuItemImage src={product.image_url} alt={product.name} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    {product.description && <div className="text-sm text-gray-800">{product.description}</div>}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{product.category_name || '-'}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">Rs {product.price}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      product.is_available 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      product.is_vegetarian 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {product.is_vegetarian ? 'Veg' : 'Non-Veg'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-700">No menu items found</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </AdminLayout>
  );
}
