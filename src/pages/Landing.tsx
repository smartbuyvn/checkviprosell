/**
 * Viprosell — Landing Page
 * Full conversion-ready landing with all sections.
 */

import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import {
  Video, ArrowRight, Upload, Link2, Play, Package, Brain, Clapperboard,
  ShieldCheck, Zap, LayoutDashboard, Subtitles, CreditCard, Users,
  ImageIcon, MessageSquareQuote, Target, ChevronDown, Sparkles, MonitorSmartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/constants/routes';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { PackageCard } from '@/components/shared/PackageCard';
import { DemoThumbnail } from '@/components/shared/DemoThumbnail';
import { StepCard } from '@/components/shared/StepCard';
import { FeatureCard } from '@/components/shared/FeatureCard';
import { PricingCard } from '@/components/shared/PricingCard';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const DEMO_ITEMS = [
  { packageBadge: 'Quick Ads', title: 'Son dưỡng môi — Test Ads 15s', hook: '"Đôi môi khô nứt? Thử ngay son dưỡng này!"', duration: '15s' },
  { packageBadge: 'Quick Ads', title: 'Kem chống nắng — Flash Ad', hook: '"Da bạn đang bị nắng hại mỗi ngày"', duration: '18s' },
  { packageBadge: 'Review Video', title: 'Serum Vitamin C — Bestie Review', hook: '"Mình dùng 2 tuần, da sáng hẳn!"', duration: '25s' },
  { packageBadge: 'Review Video', title: 'Áo thun basic — Shop Owner Review', hook: '"Chất cotton mịn, mặc cả ngày không ngán"', duration: '22s' },
  { packageBadge: 'Conversion', title: 'Máy rửa mặt — Pain-to-Sale', hook: '"Rửa mặt bằng tay = 70% bụi bẩn còn lại"', duration: '28s' },
  { packageBadge: 'Conversion', title: 'Bộ chăm sóc da — Offer CTA', hook: '"Giảm 40% chỉ hôm nay — combo 3 bước"', duration: '25s' },
];

const FAQ_ITEMS = [
  { q: 'Cần bao nhiêu ảnh sản phẩm?', a: 'Tối thiểu 3 ảnh, tối đa 8 ảnh. Ảnh rõ nét, nhiều góc, có ảnh đang sử dụng là tốt nhất.' },
  { q: 'Chỉ có link sản phẩm, không có ảnh riêng?', a: 'Bạn vẫn cần tải lên ít nhất 3 ảnh. Link sản phẩm được lưu làm ngữ cảnh để AI viết script sát hơn, nhưng Viprosell chưa tự lấy ảnh từ link.' },
  { q: 'Có cần quay video mới không?', a: 'Không bắt buộc. Viprosell dựng video từ ảnh sản phẩm thật + overlay text + subtitle. Nếu có video sẵn, bạn upload để làm rich hơn.' },
  { q: 'Tôi có cần cài gì trên máy không?', a: 'Không. Viprosell chạy hoàn toàn trên web: bạn tải ảnh lên, hệ thống xử lý rồi trả video về. Không cần cài FFmpeg, không cần máy cấu hình cao.' },
  { q: 'Khác gì video AI full generative (Sora, Runway)?', a: 'Viprosell tạo video từ ảnh/video sản phẩm thật — không AI sinh ảnh giả. Kết quả chân thật, phù hợp bán hàng trên TikTok/Reels.' },
  { q: 'Có xuất caption, subtitle không?', a: 'Có. Mỗi video đi kèm caption TikTok, Reels, hashtag, subtitle text, và thumbnail text.' },
  { q: 'Có chương trình affiliate không?', a: 'Có. Bạn giới thiệu bạn bè, nhận hoa hồng cho mỗi người dùng trả phí.' },
  { q: 'Render video ở đâu?', a: 'Trên hệ thống render của Viprosell. Bạn chỉ cần chờ rồi tải video về — thường vài phút tuỳ độ dài video.' },
];

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  /** Navigate to billing with plan pre-selected (auth) or signup (guest) */
  const handlePlanSelect = (planCode: string) => {
    if (isAuthenticated) {
      navigate(ROUTES.BILLING, { state: { selectedPlan: planCode } });
    } else {
      navigate(ROUTES.SIGNUP);
    }
  };

  return (
    <PublicLayout headerVariant="transparent" hideFooter={false}>
      {/* =================== HERO =================== */}
      <section className="pt-28 pb-20 bg-gradient-hero">
        <div className="container px-4">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl mx-auto text-center">
            <motion.div variants={fadeUp}>
              <span className="inline-block text-xs font-medium tracking-wider uppercase text-primary mb-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                Video bán hàng từ ảnh sản phẩm thật
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-5 leading-[1.1]">
              Tạo video bán hàng
              <br />
              <span className="text-gradient-primary">chốt đơn trên TikTok & Reels</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Upload 3–8 ảnh hoặc dán link sản phẩm. AI phân tích, viết script, dựng video với ảnh thật — không cần quay mới, không cần kỹ năng edit.
            </motion.p>

            {/* Dual CTA inputs */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-5">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Dán link sản phẩm..." className="pl-9 bg-card border-border" readOnly />
              </div>
              <Link to={ROUTES.SIGNUP} className="w-full sm:w-auto">
                <Button className="glow-primary font-display w-full sm:w-auto whitespace-nowrap text-white hover:text-white">
                  <Sparkles className="w-4 h-4 mr-1.5" /> Tạo video ngay
                </Button>
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link to={ROUTES.SIGNUP}>
                <Button variant="outline" size="sm">
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload ảnh / video
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Xem demo đầu ra
                </Button>
              </a>
            </motion.div>

            {/* Trust microcopy */}
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" /> Video trong 3 phút</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Local-first, bảo mật</span>
              <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-primary" /> Dùng ảnh thật, không AI giả</span>
            </motion.div>
          </motion.div>
          
          {/* HERO IMAGE SECTION */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }} className="mt-16 max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border/50 relative">
             <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent z-10 pointer-events-none" />
             <img src="/assets/hero_banner_tech.png" alt="Viprosell Workspace" className="w-full h-auto object-cover transform hover:scale-[1.02] transition-transform duration-700" />
          </motion.div>
        </div>
      </section>

      {/* =================== PACKAGES =================== */}
      <section id="packages" className="py-20 bg-gradient-section">
        <div className="container px-4">
          <SectionHeader
            badge="3 gói dịch vụ"
            title="Chọn đúng loại video cho mục tiêu bán hàng"
            subtitle="Mỗi gói tối ưu cho một mục đích cụ thể — test ads, review, hoặc chốt đơn."
          />
          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            <PackageCard
              name="Quick Ads"
              tagline="Video test nhanh"
              useCase="Tạo video quảng cáo 15–20s để test sản phẩm trên TikTok Ads, Reels Ads."
              duration="15–20 giây"
              benefits={['Hook mạnh', '1–2 USP', 'CTA rõ', 'Test nhanh']}
            />
            <PackageCard
              name="Review Video"
              tagline="Video review tăng trust"
              useCase="Video review phong cách KOC / bestie / chủ shop, tăng niềm tin để khách mua."
              duration="20–30 giây"
              benefits={['Giọng văn đời thường', 'Chi tiết sản phẩm', 'CTA mềm', '3 hooks']}
              featured
            />
            <PackageCard
              name="Conversion Video"
              tagline="Video chốt đơn"
              useCase="Video tối ưu chuyển đổi: pain → proof → offer → urgency → CTA trực tiếp."
              duration="20–30 giây"
              benefits={['Pain rõ', 'Proof sớm', 'Offer mạnh', 'CTA trực tiếp']}
            />
          </div>
        </div>
      </section>

      {/* =================== DEMO THUMBNAILS =================== */}
      <section id="demo" className="py-20 bg-gradient-section-alt">
        <div className="container px-4">
          <SectionHeader
            badge="Xem demo"
            title="Video đầu ra trông như thế nào?"
            subtitle="Mỗi video được tạo từ ảnh sản phẩm thật + script AI + overlay text + subtitle."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
            {DEMO_ITEMS.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <DemoThumbnail {...item} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =================== HOW IT WORKS =================== */}
      <section className="py-20 bg-gradient-section">
        <div className="container px-4">
          <SectionHeader
            badge="Quy trình"
            title="4 bước từ ảnh đến video bán hàng"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <StepCard step={1} icon={Package} title="Chọn gói" description="Quick Ads, Review Video, hoặc Conversion Video." />
            <StepCard step={2} icon={Upload} title="Dán link / upload" description="Dán URL sản phẩm hoặc upload 3–8 ảnh và 1 video mẫu." />
            <StepCard step={3} icon={Brain} title="AI phân tích & viết script" description="AI phân tích sản phẩm, tạo commerce angle, viết script + CTA." />
            <StepCard step={4} icon={Clapperboard} title="Render video" description="Dựng video từ ảnh thật + overlay + subtitle. Local draft mặc định." />
          </div>
        </div>
      </section>

      {/* =================== WHY Viprosell (FEATURES) =================== */}
      <section id="features" className="py-20 bg-gradient-section-alt">
        <div className="container px-4">
          <SectionHeader
            badge="Tính năng"
            title="Tại sao chọn Viprosell?"
            subtitle="Công cụ tạo video bán hàng duy nhất tập trung 100% vào seller — không phải entertainment."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <FeatureCard icon={Package} title="3 gói đúng nhu cầu" description="Mỗi gói tối ưu cho 1 mục tiêu bán hàng cụ thể." />
            <FeatureCard icon={ImageIcon} title="Asset-first" description="Dùng ảnh/video sản phẩm thật — không AI tạo hình giả." />
            <FeatureCard icon={Brain} title="AI viết script & CTA" description="AI phân tích sản phẩm, viết hook, script, caption, CTA." />
            <FeatureCard icon={ShieldCheck} title="Local-first" description="Mọi thứ chạy trên máy. Cloud chỉ là tùy chọn premium." />
            <FeatureCard icon={Subtitles} title="Caption & Subtitle" description="Tự động tạo subtitle, caption TikTok/Reels, hashtag." />
            <FeatureCard icon={LayoutDashboard} title="Dashboard quản lý" description="Quản lý project, theo dõi trạng thái, lịch sử render." />
            <FeatureCard icon={CreditCard} title="Billing minh bạch" description="Hệ thống credits rõ ràng, thanh toán an toàn." />
            <FeatureCard icon={Users} title="Affiliate program" description="Giới thiệu bạn bè, nhận hoa hồng mỗi lượt mua." />
          </div>
        </div>
      </section>

      {/* =================== REAL-WORLD DEMOS =================== */}
      <section className="py-20 bg-gradient-section overflow-hidden">
        <div className="container px-4">
          <SectionHeader
            badge="Kết quả thực tế"
            title="Đẳng cấp chuyên nghiệp trên mọi thiết bị"
            subtitle="Từ Quick Ads ngắn gọn đến Review chi tiết, Viprosell tự động tối ưu tỷ lệ khung hình và nội dung."
          />
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto mt-10">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500" />
              <img src="/assets/quick_ads_demo.png" alt="Quick Ads Demo" className="relative rounded-xl border border-border shadow-2xl w-full object-cover" />
              <div className="absolute bottom-6 left-6 right-6 bg-background/80 backdrop-blur-md p-4 rounded-lg border border-white/10 shadow-lg">
                <h4 className="font-display font-semibold text-foreground mb-1">Quick Ads cho Di động</h4>
                <p className="text-sm text-muted-foreground">Tối ưu dọc 9:16 cho TikTok & Reels với Hook siêu mạnh.</p>
              </div>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative group mt-12 md:mt-0">
              <div className="absolute -inset-1 bg-gradient-to-l from-primary/30 to-blue-500/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500" />
              <img src="/assets/review_demo.png" alt="Review Video Demo" className="relative rounded-xl border border-border shadow-2xl w-full object-cover" />
              <div className="absolute bottom-6 left-6 right-6 bg-background/80 backdrop-blur-md p-4 rounded-lg border border-white/10 shadow-lg">
                <h4 className="font-display font-semibold text-foreground mb-1">Product Review chuyên sâu</h4>
                <p className="text-sm text-muted-foreground">Bố cục ngang dọc tùy chỉnh, script tự nhiên chốt đơn mượt mà.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =================== PRICING =================== */}
      <section id="pricing" className="py-20 bg-gradient-section-alt">
        <div className="container px-4">
          <SectionHeader
            badge="Bảng giá"
            title="Giá minh bạch, không phí ẩn"
            subtitle="Chọn gói phù hợp, nâng cấp bất kỳ lúc nào."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            <PricingCard
              name="Free"
              price="Miễn phí"
              period="tháng"
              description="5 credits"
              features={['5 credits miễn phí', 'Draft local render', '3 loại video', 'Overlay cơ bản']}
              ctaLabel="Bắt đầu miễn phí"
              onCta={() => handlePlanSelect('free')}
            />
            <PricingCard
              name="Pro"
              price="130.000₫"
              period="tháng"
              description="50 credits"
              features={['50 credits/tháng', 'Draft + Voice render', 'Ưu tiên AI xử lý', 'Tất cả loại video', 'Xuất caption']}
              featured
              ctaLabel="Chọn Pro"
              onCta={() => handlePlanSelect('pro')}
            />
            <PricingCard
              name="Business"
              price="250.000₫"
              period="tháng"
              description="110 credits"
              features={['110 credits/tháng', 'Premium cloud render', 'Hỗ trợ ưu tiên', 'Tất cả tính năng', 'API access']}
              ctaLabel="Chọn Business"
              onCta={() => handlePlanSelect('business')}
            />
            <PricingCard
              name="Premium"
              price="520.000₫"
              period="tháng"
              description="240 credits"
              features={['240 credits/tháng', 'Premium cloud render', 'Dự án không giới hạn', 'Không watermark', 'Custom branding']}
              ctaLabel="Chọn Premium"
              onCta={() => handlePlanSelect('premium')}
            />
          </div>
          <div className="text-center mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Xem chi tiết bảng giá <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* =================== FAQ =================== */}
      <section id="faq" className="py-20 bg-gradient-section">
        <div className="container px-4">
          <SectionHeader
            badge="Câu hỏi thường gặp"
            title="FAQ"
          />
          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-2">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-surface rounded-xl border-none px-5">
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* =================== FINAL CTA =================== */}
      <section className="py-20 bg-gradient-hero">
        <div className="container px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="font-display text-2xl md:text-4xl font-bold text-foreground mb-4">
              Bắt đầu tạo video bán hàng ngay
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Chỉ cần ảnh sản phẩm — Viprosell lo phần còn lại. Miễn phí bắt đầu, không cần thẻ tín dụng.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to={ROUTES.SIGNUP}>
                <Button size="lg" className="font-display glow-primary text-white hover:text-white">
                  <Sparkles className="w-4 h-4 mr-2" /> Tạo video đầu tiên miễn phí
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" variant="outline">
                  <Play className="w-4 h-4 mr-2" /> Xem demo
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

    </PublicLayout>
  );
};

export default Landing;
