import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { RenderJobStatus } from "@/components/tools/RenderJobStatus";
import { Images, Sparkles, Plus, Trash2 } from "lucide-react";

export default function ImagesToVideo() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [productTitle, setProductTitle] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleImageUrlChange = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const addImageUrl = () => {
    if (imageUrls.length >= 6) {
      toast({ title: 'Tối đa 6 ảnh', variant: 'destructive' });
      return;
    }
    setImageUrls([...imageUrls, '']);
  };

  const removeImageUrl = (index: number) => {
    if (imageUrls.length <= 3) {
      toast({ title: 'Tối thiểu 3 ảnh', variant: 'destructive' });
      return;
    }
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newUrls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validUrls = imageUrls.filter(url => url.trim() !== '');
    if (validUrls.length < 3) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập ít nhất 3 URL ảnh hợp lệ', variant: 'destructive' });
      return;
    }
    if (!productTitle.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tên sản phẩm', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    setJobId(null);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
      const res = await fetch(`${API_BASE}/quick-ads/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          product_title: productTitle,
          image_urls: validUrls 
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start render job');
      }

      const data = await res.json();
      setJobId(data.job_id);
      toast({ title: 'Thành công', description: 'Đã gửi yêu cầu tạo video!' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-3xl py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center">
          <Sparkles className="mr-3 text-indigo-400" /> 1-Click: Images to Video
        </h1>
        <p className="text-slate-400">
          Cung cấp tên sản phẩm và 3-6 đường dẫn ảnh, AI sẽ tự động phân tích tính năng sản phẩm dựa vào hình ảnh để viết kịch bản và dựng video.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-white">
        <CardHeader>
          <CardTitle>Nhập Hình Ảnh Sản Phẩm</CardTitle>
          <CardDescription className="text-slate-400">
            Cần ít nhất 3 ảnh (URL) để AI có đủ dữ liệu dựng video 15-30 giây.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="title">Tên sản phẩm / Điểm nổi bật</Label>
              <Input 
                id="title"
                placeholder="Ví dụ: Áo thun nam cotton cao cấp..."
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                className="bg-slate-950 border-slate-800"
                disabled={isSubmitting || !!jobId}
                required
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Danh sách URL ảnh (3-6 ảnh)</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addImageUrl}
                  disabled={isSubmitting || !!jobId || imageUrls.length >= 6}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" /> Thêm ảnh
                </Button>
              </div>

              {imageUrls.map((url, index) => (
                <div key={index} className="flex space-x-2 items-center">
                  <div className="relative flex-1">
                    <Images className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                      placeholder={`https://example.com/image${index + 1}.jpg`}
                      value={url}
                      onChange={(e) => handleImageUrlChange(index, e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-800"
                      disabled={isSubmitting || !!jobId}
                      required={index < 3}
                    />
                  </div>
                  {imageUrls.length > 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeImageUrl(index)}
                      disabled={isSubmitting || !!jobId}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || !!jobId}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmitting ? 'Đang gửi...' : 'Tạo Video Ngay'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {jobId && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <RenderJobStatus jobId={jobId} />
          <div className="mt-4 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => {
                setJobId(null);
                setProductTitle('');
                setImageUrls(['', '', '']);
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Tạo video khác
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
