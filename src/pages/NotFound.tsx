import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFound = () => (
  <div className="min-h-screen bg-background flex items-center justify-center px-4">
    <div className="text-center space-y-4">
      <h1 className="font-display text-6xl font-bold text-foreground">404</h1>
      <p className="text-muted-foreground">Trang bạn tìm không tồn tại.</p>
      <Link to="/">
        <Button variant="outline">Về trang chủ</Button>
      </Link>
    </div>
  </div>
);

export default NotFound;
