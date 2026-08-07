import React from 'react';

function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', background: '#090d16', color: '#fff', minHeight: '100vh' }}>
      <h1>{statusCode ? `${statusCode} — Server Error` : 'An error occurred'}</h1>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
