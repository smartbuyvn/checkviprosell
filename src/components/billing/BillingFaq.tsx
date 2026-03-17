/**
 * Viprosell â€” Billing FAQ Component
 */
import { HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ_ITEMS = [
  { q: 'Thanh toÃ¡n báº±ng gÃ¬?', a: 'ChÃºng tÃ´i há»— trá»£ thanh toÃ¡n qua Visa, Mastercard, vÃ  PayPal. Táº¥t cáº£ giao dá»‹ch Ä‘Æ°á»£c mÃ£ hÃ³a an toÃ n.' },
  { q: 'CÃ³ thá»ƒ há»§y gÃ³i báº¥t ká»³ lÃºc nÃ o khÃ´ng?', a: 'CÃ³. Báº¡n cÃ³ thá»ƒ há»§y gÃ³i Ä‘Äƒng kÃ½ báº¥t ká»³ lÃºc nÃ o. GÃ³i sáº½ cÃ²n hiá»‡u lá»±c Ä‘áº¿n háº¿t chu ká»³ thanh toÃ¡n hiá»‡n táº¡i.' },
  { q: 'Credits chÆ°a dÃ¹ng cÃ³ bá»‹ máº¥t khÃ´ng?', a: 'KhÃ´ng. Credits khÃ´ng cÃ³ háº¡n sá»­ dá»¥ng vÃ  sáº½ Ä‘Æ°á»£c giá»¯ nguyÃªn cho Ä‘áº¿n khi báº¡n sá»­ dá»¥ng.' },
  { q: 'CÃ³ hoÃ n tiá»n khÃ´ng?', a: 'ChÃºng tÃ´i há»— trá»£ hoÃ n tiá»n trong 7 ngÃ y Ä‘áº§u ká»ƒ tá»« láº§n thanh toÃ¡n Ä‘áº§u tiÃªn náº¿u báº¡n chÆ°a sá»­ dá»¥ng dá»‹ch vá»¥. LiÃªn há»‡ support Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£.' },
  { q: 'NÃ¢ng cáº¥p gÃ³i thÃ¬ credits cÅ© ra sao?', a: 'Khi nÃ¢ng cáº¥p, credits cÅ© váº«n giá»¯ nguyÃªn. Credits má»›i cá»§a gÃ³i sáº½ Ä‘Æ°á»£c cá»™ng thÃªm vÃ o tÃ i khoáº£n.' },
  { q: 'CÃ³ thá»ƒ mua thÃªm credits ngoÃ i gÃ³i khÃ´ng?', a: 'CÃ³. Báº¡n cÃ³ thá»ƒ mua credit packs bá»• sung báº¥t ká»³ lÃºc nÃ o tá»« trang Billing.' },
];

export function BillingFaq() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-4 h-4 text-primary" />
        <h2 className="font-display text-base font-semibold text-foreground">CÃ¢u há»i vá» thanh toÃ¡n</h2>
      </div>
      <Accordion type="single" collapsible className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`bfaq-${i}`} className="bg-card rounded-xl border-none px-5">
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
  );
}
