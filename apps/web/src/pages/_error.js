/**
 * Custom Pages Router _error - used for 404/500 prerender.
 * Minimal component, no hooks or context, to avoid "useContext of null" during static gen.
 */
function Error({ statusCode }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1>{statusCode || 'Error'}</h1>
      <p>{statusCode === 404 ? 'Page not found' : 'Something went wrong'}</p>
      <a href="/" style={{ marginTop: '1rem', color: '#6366f1' }}>Go home</a>
    </div>
  );
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
