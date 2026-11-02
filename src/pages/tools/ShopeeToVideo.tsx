import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { RenderJobStatus } from "@/components/tools/RenderJobStatus";
import { Link2, Sparkles } from "lucide-react";
import { fetchWithTimeout } from '@/lib/fetchUtils';

export default function ShopeeToVideo() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !url.includes('shopee.')) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập link Shopee hợp lệ', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    setJobId(null);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
      // useAuth() KHONG co truong session, nen cach cu luon gui "Bearer undefined"
      // va backend tu choi 401. Lay token ngay luc goi, getSession() con tu lam moi.
      const { data: { session } } = await supabase.auth.getSession();
      // Hạn chờ: cả codebase dùng `fetchWithTimeout`. `fetch` trần treo vô hạn khi
      // backend không trả lời, và giao diện chỉ còn một vòng xoay không lối thoát.
      const res = await fetchWithTimeout(`${API_BASE}/quick-ads/render`, {
        timeout: 60000,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`
        },
        body: JSON.stringify({ product_url: url })
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
          <Sparkles className="mr-3 text-indigo-400" /> 1-Click: Shopee to Video
        </h1>
        <p className="text-slate-400">
          Chỉ cần dán link Shopee, AI sẽ tự động phân tích sản phẩm, viết kịch bản, và dựng video Tiktok hoàn chỉnh.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-white">
        <CardHeader>
          <CardTitle>Nhập Link Shopee</CardTitle>
          <CardDescription className="text-slate-400">
            Hỗ trợ link shopee.vn. Thời gian xử lý mất khoảng 1-2 phút tùy cấu hình Local GPU.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL Sản phẩm</Label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    id="url"
                    placeholder="https://shopee.vn/product/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-9 bg-slate-950 border-slate-800"
                    disabled={isSubmitting || !!jobId}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !!jobId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmitting ? 'Đang gửi...' : 'Tạo Video Ngay'}
                </Button>
              </div>
            </div>
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
                setUrl('');
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
