import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, children, ...rest }: Props) {
  const variantClass = styles[variant];
  return (
    <button
      className={`${styles.button} ${variantClass} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
