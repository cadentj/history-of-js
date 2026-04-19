import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

type Props = {
  url: string | null;
  nonce?: number;
  onCopyUrl: () => void;
  copied?: boolean;
  toolbarExtras?: ReactNode;
};

export function PreviewPane({ url, nonce = 0, onCopyUrl, copied = false, toolbarExtras }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
            Preview
          </span>
          {toolbarExtras}
        </div>
        <Button type="button" size="xs" variant="ghost" onClick={onCopyUrl} disabled={!url}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied!' : 'Copy URL'}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {url ? (
          <iframe
            key={`${url}#${nonce}`}
            className="h-full w-full border-0 bg-background"
            title="Lesson preview"
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Waiting for dev server…
          </div>
        )}
      </div>
    </div>
  );
}
