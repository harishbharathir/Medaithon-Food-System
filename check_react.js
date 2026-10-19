const http = require('http');

http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Has root div:', data.includes('<div id="root"></div>'));
    console.log('Has Vite bundle script:', data.includes('/assets/index-'));
    console.log('Preview first 200 chars:\n', data.slice(0, 200));
  });
});
