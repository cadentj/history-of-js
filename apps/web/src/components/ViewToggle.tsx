import { Button } from '@/components/ui/button';

type Props = {
  value: 'editor' | 'preview';
  onChange: (next: 'editor' | 'preview') => void;
  disabled?: boolean;
};

export function ViewToggle({ value, onChange, disabled }: Props) {
  return (
    <div className="bg-muted/50 inline-flex shrink-0 rounded-md border border-border p-0.5">
      <Button
        type="button"
        size="xs"
        variant={value === 'editor' ? 'secondary' : 'ghost'}
        className="h-7 px-2 text-[11px]"
        disabled={disabled}
        onClick={() => onChange('editor')}
      >
        Editor
      </Button>
      <Button
        type="button"
        size="xs"
        variant={value === 'preview' ? 'secondary' : 'ghost'}
        className="h-7 px-2 text-[11px]"
        disabled={disabled}
        onClick={() => onChange('preview')}
      >
        Preview
      </Button>
    </div>
  );
}
