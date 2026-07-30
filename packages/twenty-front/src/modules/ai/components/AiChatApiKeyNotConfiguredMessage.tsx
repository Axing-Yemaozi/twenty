import { AiChatBanner } from '@/ai/components/AiChatBanner';
import { t } from '@lingui/core/macro';

export const AiChatApiKeyNotConfiguredMessage = () => (
  <AiChatBanner
    message={t`AI not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or XAI_API_KEY in your environment.`}
    variant="warning"
  />
);
