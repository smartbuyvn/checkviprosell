/**
 * Viprosell â€” Landing Page
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
  { packageBadge: 'Quick Ads', title: 'Son dÆ°á»¡ng mÃ´i â€” Test Ads 15s', hook: '"ÄÃ´i mÃ´i khÃ´ ná»©t? Thá»­ ngay son dÆ°á»¡ng nÃ y!"', duration: '15s' },
  { packageBadge: 'Quick Ads', title: 'Kem chá»‘ng náº¯ng â€” Flash Ad', hook: '"Da báº¡n Ä‘ang bá»‹ náº¯ng háº¡i má»—i ngÃ y"', duration: '18s' },
  { packageBadge: 'Review Video', title: 'Serum Vitamin C â€” Bestie Review', hook: '"MÃ¬nh dÃ¹ng 2 tuáº§n, da sÃ¡ng háº³n!"', duration: '25s' },
  { packageBadge: 'Review Video', title: 'Ão thun basic â€” Shop Owner Review', hook: '"Cháº¥t cotton má»‹n, máº·c cáº£ ngÃ y khÃ´ng ngÃ¡n"', duration: '22s' },
  { packageBadge: 'Conversion', title: 'MÃ¡y rá»­a máº·t â€” Pain-to-Sale', hook: '"Rá»­a máº·t báº±ng tay = 70% bá»¥i báº©n cÃ²n láº¡i"', duration: '28s' },
  { packageBadge: 'Conversion', title: 'Bá»™ chÄƒm sÃ³c da â€” Offer CTA', hook: '"Giáº£m 40% chá»‰ hÃ´m nay â€” combo 3 bÆ°á»›c"', duration: '25s' },
];

const FAQ_ITEMS = [
  { q: 'Cáº§n bao nhiÃªu áº£nh sáº£n pháº©m?', a: 'Tá»‘i thiá»ƒu 3 áº£nh, tá»‘i Ä‘a 8 áº£nh. áº¢nh rÃµ nÃ©t, nhiá»u gÃ³c, cÃ³ áº£nh Ä‘ang sá»­ dá»¥ng lÃ  tá»‘t nháº¥t.' },
  { q: 'Chá»‰ cÃ³ link sáº£n pháº©m, khÃ´ng cÃ³ áº£nh riÃªng?', a: 'Viprosell sáº½ tá»± crawl áº£nh tá»« link sáº£n pháº©m náº¿u báº¡n chá»‰ dÃ¡n URL. Báº¡n cÃ³ thá»ƒ bá»• sung áº£nh riÃªng sau.' },
  { q: 'CÃ³ cáº§n quay video má»›i khÃ´ng?', a: 'KhÃ´ng báº¯t buá»™c. Viprosell dá»±ng video tá»« áº£nh sáº£n pháº©m tháº­t + overlay text + subtitle. Náº¿u cÃ³ video sáºµn, báº¡n upload Ä‘á»ƒ lÃ m rich hÆ¡n.' },
  { q: 'App cÃ³ cháº¡y Ä‘Æ°á»£c khi táº¯t cloud khÃ´ng?', a: 'CÃ³. Viprosell lÃ  local-first â€” táº¥t cáº£ phÃ¢n tÃ­ch, script, render draft Ä‘á»u cháº¡y trÃªn mÃ¡y. Cloud chá»‰ lÃ  tÃ¹y chá»n premium.' },
  { q: 'KhÃ¡c gÃ¬ video AI full generative (Sora, Runway)?', a: 'Viprosell táº¡o video tá»« áº£nh/video sáº£n pháº©m tháº­t â€” khÃ´ng AI sinh áº£nh giáº£. Káº¿t quáº£ chÃ¢n tháº­t, phÃ¹ há»£p bÃ¡n hÃ ng trÃªn TikTok/Reels.' },
  { q: 'CÃ³ xuáº¥t caption, subtitle khÃ´ng?', a: 'CÃ³. Má»—i video Ä‘i kÃ¨m caption TikTok, Reels, hashtag, subtitle text, vÃ  thumbnail text.' },
  { q: 'CÃ³ chÆ°Æ¡ng trÃ¬nh affiliate khÃ´ng?', a: 'CÃ³. Báº¡n giá»›i thiá»‡u báº¡n bÃ¨, nháº­n hoa há»“ng cho má»—i ngÆ°á»i dÃ¹ng tráº£ phÃ­.' },
  { q: 'Render video á»Ÿ Ä‘Ã¢u?', a: 'Máº·c Ä‘á»‹nh render draft trÃªn mÃ¡y (local). Náº¿u báº­t premium render, cÃ³ thá»ƒ render cháº¥t lÆ°á»£ng cao trÃªn cloud.' },
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
                Video bÃ¡n hÃ ng tá»« áº£nh sáº£n pháº©m tháº­t
              </span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-5 leading-[1.1]">
              Táº¡o video bÃ¡n hÃ ng ngáº¯n
              <br />
              <span className="text-gradient-primary">chá»‘t Ä‘Æ¡n trÃªn TikTok & Reels</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Upload 3â€“8 áº£nh hoáº·c dÃ¡n link sáº£n pháº©m. AI phÃ¢n tÃ­ch, viáº¿t script, dá»±ng video vá»›i áº£nh tháº­t â€” khÃ´ng cáº§n quay má»›i, khÃ´ng cáº§n ká»¹ nÄƒng edit.
            </motion.p>

            {/* Dual CTA inputs */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-5">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="DÃ¡n link sáº£n pháº©m..." className="pl-9 bg-card border-border" readOnly />
              </div>
              <Link to={ROUTES.SIGNUP}>
                <Button className="glow-primary font-display w-full sm:w-auto whitespace-nowrap">
                  <Sparkles className="w-4 h-4 mr-1.5" /> Táº¡o video ngay
                </Button>
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link to={ROUTES.SIGNUP}>
                <Button variant="outline" size="sm">
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload áº£nh / video
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Xem demo Ä‘áº§u ra
                </Button>
              </a>
            </motion.div>

            {/* Trust microcopy */}
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" /> Video trong 3 phÃºt</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Local-first, báº£o máº­t</span>
              <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-primary" /> DÃ¹ng áº£nh tháº­t, khÃ´ng AI giáº£</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* =================== PACKAGES =================== */}
      <section id="packages" className="py-20 bg-gradient-section">
        <div className="container px-4">
          <SectionHeader
            badge="3 gÃ³i dá»‹ch vá»¥"
            title="Chá»n Ä‘Ãºng loáº¡i video cho má»¥c tiÃªu bÃ¡n hÃ ng"
            subtitle="Má»—i gÃ³i tá»‘i Æ°u cho má»™t má»¥c Ä‘Ã­ch cá»¥ thá»ƒ â€” test ads, review, hoáº·c chá»‘t Ä‘Æ¡n."
          />
          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            <PackageCard
              name="Quick Ads"
              tagline="Video test nhanh"
              useCase="Táº¡o video quáº£ng cÃ¡o 15â€“20s Ä‘á»ƒ test sáº£n pháº©m trÃªn TikTok Ads, Reels Ads."
              duration="15â€“20 giÃ¢y"
              benefits={['Hook máº¡nh', '1â€“2 USP', 'CTA rÃµ', 'Test nhanh']}
            />
            <PackageCard
              name="Review Video"
              tagline="Video review tÄƒng trust"
              useCase="Video review phong cÃ¡ch KOC / bestie / chá»§ shop, tÄƒng niá»m tin Ä‘á»ƒ khÃ¡ch mua."
              duration="20â€“30 giÃ¢y"
              benefits={['Giá»ng vÄƒn Ä‘á»i thÆ°á»ng', 'Chi tiáº¿t sáº£n pháº©m', 'CTA má»m', '3 hooks']}
              featured
            />
            <PackageCard
              name="Conversion Video"
              tagline="Video chá»‘t Ä‘Æ¡n"
              useCase="Video tá»‘i Æ°u chuyá»ƒn Ä‘á»•i: pain â†’ proof â†’ offer â†’ urgency â†’ CTA trá»±c tiáº¿p."
              duration="20â€“30 giÃ¢y"
              benefits={['Pain rÃµ', 'Proof sá»›m', 'Offer máº¡nh', 'CTA trá»±c tiáº¿p']}
            />
          </div>
        </div>
      </section>

      {/* =================== DEMO THUMBNAILS =================== */}
      <section id="demo" className="py-20 bg-gradient-section-alt">
        <div className="container px-4">
          <SectionHeader
            badge="Xem demo"
            title="Video Ä‘áº§u ra trÃ´ng nhÆ° tháº¿ nÃ o?"
            subtitle="Má»—i video Ä‘Æ°á»£c táº¡o tá»« áº£nh sáº£n pháº©m tháº­t + script AI + overlay text + subtitle."
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
            badge="Quy trÃ¬nh"
            title="4 bÆ°á»›c tá»« áº£nh Ä‘áº¿n video bÃ¡n hÃ ng"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <StepCard step={1} icon={Package} title="Chá»n gÃ³i" description="Quick Ads, Review Video, hoáº·c Conversion Video." />
            <StepCard step={2} icon={Upload} title="DÃ¡n link / upload" description="DÃ¡n URL sáº£n pháº©m hoáº·c upload 3â€“8 áº£nh vÃ  1 video máº«u." />
            <StepCard step={3} icon={Brain} title="AI phÃ¢n tÃ­ch & viáº¿t script" description="AI phÃ¢n tÃ­ch sáº£n pháº©m, táº¡o commerce angle, viáº¿t script + CTA." />
            <StepCard step={4} icon={Clapperboard} title="Render video" description="Dá»±ng video tá»« áº£nh tháº­t + overlay + subtitle. Local draft máº·c Ä‘á»‹nh." />
          </div>
        </div>
      </section>

      {/* =================== WHY Viprosell (FEATURES) =================== */}
      <section id="features" className="py-20 bg-gradient-section-alt">
        <div className="container px-4">
          <SectionHeader
            badge="TÃ­nh nÄƒng"
            title="Táº¡i sao chá»n Viprosell?"
            subtitle="CÃ´ng cá»¥ táº¡o video bÃ¡n hÃ ng duy nháº¥t táº­p trung 100% vÃ o seller â€” khÃ´ng pháº£i entertainment."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <FeatureCard icon={Package} title="3 gÃ³i Ä‘Ãºng nhu cáº§u" description="Má»—i gÃ³i tá»‘i Æ°u cho 1 má»¥c tiÃªu bÃ¡n hÃ ng cá»¥ thá»ƒ." />
            <FeatureCard icon={ImageIcon} title="Asset-first" description="DÃ¹ng áº£nh/video sáº£n pháº©m tháº­t â€” khÃ´ng AI táº¡o hÃ¬nh giáº£." />
            <FeatureCard icon={Brain} title="AI viáº¿t script & CTA" description="AI phÃ¢n tÃ­ch sáº£n pháº©m, viáº¿t hook, script, caption, CTA." />
            <FeatureCard icon={ShieldCheck} title="Local-first" description="Má»i thá»© cháº¡y trÃªn mÃ¡y. Cloud chá»‰ lÃ  tÃ¹y chá»n premium." />
            <FeatureCard icon={Subtitles} title="Caption & Subtitle" description="Tá»± Ä‘á»™ng táº¡o subtitle, caption TikTok/Reels, hashtag." />
            <FeatureCard icon={LayoutDashboard} title="Dashboard quáº£n lÃ½" description="Quáº£n lÃ½ project, theo dÃµi tráº¡ng thÃ¡i, lá»‹ch sá»­ render." />
            <FeatureCard icon={CreditCard} title="Billing minh báº¡ch" description="Há»‡ thá»‘ng credits rÃµ rÃ ng, thanh toÃ¡n an toÃ n." />
            <FeatureCard icon={Users} title="Affiliate program" description="Giá»›i thiá»‡u báº¡n bÃ¨, nháº­n hoa há»“ng má»—i lÆ°á»£t mua." />
          </div>
        </div>
      </section>

      {/* =================== OUTCOMES =================== */}
      <section className="py-20 bg-gradient-section">
        <div className="container px-4">
          <SectionHeader
            badge="Káº¿t quáº£ thá»±c táº¿"
            title="Tá»« nguyÃªn liá»‡u â†’ video bÃ¡n hÃ ng"
            subtitle="KhÃ´ng cáº§n quay phim, khÃ´ng cáº§n editor. Chá»‰ cáº§n áº£nh sáº£n pháº©m."
          />
          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              { icon: Link2, before: 'Link sáº£n pháº©m Shopee/Tiki', after: 'Video test ads 15s cháº¡y TikTok Ads' },
              { icon: ImageIcon, before: '5 áº£nh sáº£n pháº©m chá»¥p Ä‘iá»‡n thoáº¡i', after: 'Video review style KOC 25s' },
              { icon: Target, before: 'Pain point khÃ¡ch hÃ ng', after: 'Video chá»‘t Ä‘Æ¡n painâ†’proofâ†’offer 28s' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="rounded-xl p-5 bg-surface shadow-card"
              >
                <item.icon className="w-8 h-8 text-primary mb-3" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">TrÆ°á»›c</span>
                    <p className="text-sm text-muted-foreground">{item.before}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">Sau</span>
                    <p className="text-sm text-foreground font-medium">{item.after}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =================== PRICING =================== */}
      <section id="pricing" className="py-20 bg-gradient-section-alt">
        <div className="container px-4">
          <SectionHeader
            badge="Báº£ng giÃ¡"
            title="GiÃ¡ minh báº¡ch, khÃ´ng phÃ­ áº©n"
            subtitle="Chá»n gÃ³i phÃ¹ há»£p, nÃ¢ng cáº¥p báº¥t ká»³ lÃºc nÃ o."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            <PricingCard
              name="Free"
              price="Miá»…n phÃ­"
              period="thÃ¡ng"
              description="5 credits"
              features={['5 credits miá»…n phÃ­', 'Draft local render', '3 loáº¡i video', 'Overlay cÆ¡ báº£n']}
              ctaLabel="Báº¯t Ä‘áº§u miá»…n phÃ­"
              onCta={() => handlePlanSelect('free')}
            />
            <PricingCard
              name="Pro"
              price="130.000â‚«"
              period="thÃ¡ng"
              description="50 credits"
              features={['50 credits/thÃ¡ng', 'Draft + Voice render', 'Æ¯u tiÃªn AI xá»­ lÃ½', 'Táº¥t cáº£ loáº¡i video', 'Xuáº¥t caption']}
              featured
              ctaLabel="Chá»n Pro"
              onCta={() => handlePlanSelect('pro')}
            />
            <PricingCard
              name="Business"
              price="250.000â‚«"
              period="thÃ¡ng"
              description="110 credits"
              features={['110 credits/thÃ¡ng', 'Premium cloud render', 'Há»— trá»£ Æ°u tiÃªn', 'Táº¥t cáº£ tÃ­nh nÄƒng', 'API access']}
              ctaLabel="Chá»n Business"
              onCta={() => handlePlanSelect('business')}
            />
            <PricingCard
              name="Premium"
              price="520.000â‚«"
              period="thÃ¡ng"
              description="240 credits"
              features={['240 credits/thÃ¡ng', 'Premium cloud render', 'Dá»± Ã¡n khÃ´ng giá»›i háº¡n', 'KhÃ´ng watermark', 'Custom branding']}
              ctaLabel="Chá»n Premium"
              onCta={() => handlePlanSelect('premium')}
            />
          </div>
          <div className="text-center mt-8">
            <Link to={ROUTES.PRICING}>
              <Button variant="outline" size="sm">Xem chi tiáº¿t báº£ng giÃ¡ <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* =================== FAQ =================== */}
      <section id="faq" className="py-20 bg-gradient-section">
        <div className="container px-4">
          <SectionHeader
            badge="CÃ¢u há»i thÆ°á»ng gáº·p"
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
              Báº¯t Ä‘áº§u táº¡o video bÃ¡n hÃ ng ngay
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Chá»‰ cáº§n áº£nh sáº£n pháº©m â€” Viprosell lo pháº§n cÃ²n láº¡i. Miá»…n phÃ­ báº¯t Ä‘áº§u, khÃ´ng cáº§n tháº» tÃ­n dá»¥ng.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to={ROUTES.SIGNUP}>
                <Button size="lg" className="font-display glow-primary">
                  <Sparkles className="w-4 h-4 mr-2" /> Táº¡o video Ä‘áº§u tiÃªn miá»…n phÃ­
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
