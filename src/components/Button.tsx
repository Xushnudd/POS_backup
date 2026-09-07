import Button, { ButtonProps } from './ui/Button';

export default function LegacyButton({
  children,
  style = 'default',
  ...props
}: ButtonProps & { style?: 'success' | 'danger' | 'default' }) {
  return (
    <Button styleVariant={style} {...props}>
      {children}
    </Button>
  );
}