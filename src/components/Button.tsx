type ButtonStyle = 'success' | 'danger' | 'default'

interface ButtonProps {
  children: any;
  style?: ButtonStyle;
}

const styles: Record<ButtonStyle, string> = {
  success: 'bg-green-700 text-white',
  danger: 'bg-red-700 text-white',
  default: 'border border-gray-200 text-gray-700'
}

export default function Button({ children, style = 'default' }: ButtonProps) {
  return (
    <button className={`${styles[style]} p-3 rounded-xl text-xl cursor-pointer hover:opacity-90 active:opacity-50`}>{children}</button>
  );
}