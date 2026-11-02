import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from '@/lib/fetchUtils';

interface RenderJobStatusProps {
  jobId: string;
  onCompleted?: (url: string) => void;
}

export const RenderJobStatus: React.FC<RenderJobStatusProps> = ({ jobId, onCompleted }) => {
  const [status, setStatus] = useState<string>('pending');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
        // Lấy token ngay lúc gửi: useAuth() KHÔNG có trường session, nên cách cũ
        // `const { session } = useAuth()` luôn cho undefined và header gửi đi là
        // "Bearer undefined" — backend từ chối 401, tính năng không chạy được bao giờ.
        // getSession() còn tự làm mới token sắp hết hạn, điều mà biến lưu sẵn không làm được.
        const { data: { session } } = await supabase.auth.getSession();
        // Lenh hoi trang thai, goi lai dinh ky — han cho phai ngan.
        const res = await fetchWithTimeout(`${API_BASE}/quick-ads/status/${jobId}`, {
          timeout: 8000,
          headers: {
            'Authorization': `Bearer ${session?.access_token ?? ''}`
          }
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch status');
        }

        const data = await res.json();
        
        if (data.status) setStatus(data.status);
        if (data.progress !== undefined) setProgress(data.progress);
        
        if (data.status === 'completed' && data.output_url) {
          setOutputUrl(data.output_url);
          if (onCompleted) onCompleted(data.output_url);
        } else if (data.status === 'failed') {
          setError(data.error || 'Render failed');
        }

      } catch (err: any) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
    // Bỏ `session` khỏi danh sách phụ thuộc: nó không còn là biến ngoài nữa,
    // token được lấy mới ở mỗi lần gọi bên trong.
  }, [jobId, status, onCompleted]);

  return (
    <Card className="w-full bg-slate-900 border-slate-800 text-white mt-4">
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          
          {status === 'pending' || status === 'processing' || status === 'rendering' ? (
            <>
              <div className="flex items-center space-x-3 text-indigo-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="font-medium text-lg">
                  {status === 'pending' ? 'Đang xếp hàng...' : 'Đang xử lý AI & Render...'}
                </span>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={progress} className="h-2 bg-slate-800" />
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Tiến trình</span>
                  <span>{progress}%</span>
                </div>
              </div>
            </>
          ) : status === 'completed' ? (
            <>
              <div className="flex items-center space-x-3 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
                <span className="font-medium text-lg">Hoàn tất!</span>
              </div>
              {outputUrl && (
                <div className="w-full max-w-md mt-4 aspect-[9/16] bg-black rounded-lg overflow-hidden border border-slate-700">
                  <video 
                    src={outputUrl} 
                    controls 
                    autoPlay 
                    loop 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center space-x-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <span className="font-medium text-lg">Lỗi: {error}</span>
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
};
