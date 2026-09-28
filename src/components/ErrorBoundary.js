import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error inesperado en la aplicación:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={styles.page}>
        <div style={styles.symbol}>⚠</div>
        <h1 style={styles.title}>La escena se interrumpió</h1>
        <p style={styles.copy}>Tus datos siguen guardados. Recargá la aplicación para volver a sincronizarla.</p>
        <button style={styles.button} onClick={() => window.location.reload()}>Recargar</button>
      </main>
    );
  }
}

const styles = {
  page: { minHeight: '70vh', display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 12, padding: 24, textAlign: 'center' },
  symbol: { color: 'var(--ember)', fontSize: 34 },
  title: { margin: 0, color: 'var(--gold-bright)', fontFamily: 'Cinzel,serif', fontSize: 22, letterSpacing: 2 },
  copy: { maxWidth: 440, color: 'var(--parchment-dim)', fontFamily: 'Crimson Pro,serif', fontSize: 15, lineHeight: 1.6 },
  button: { padding: '10px 18px', color: '#1a1206', background: 'var(--gold)', border: 0, borderRadius: 4, fontFamily: 'Cinzel,serif', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer' },
};
