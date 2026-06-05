const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function test() {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  
  // Create a JSDOM instance that can load external scripts (or we can mock tailwind)
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable'
  });
  
  console.log('Window loaded. Waiting for scripts to run...');
  
  // Wait for 5 seconds to let Tailwind CDN load and run
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const doc = dom.window.document;
  const styles = doc.querySelectorAll('style');
  console.log('Number of style elements found:', styles.length);
  
  styles.forEach((style, index) => {
    console.log(`Style element ${index} ID:`, style.id);
    console.log(`Style element ${index} contains bg-zinc-950:`, style.innerHTML.includes('bg-zinc-950'));
    console.log(`Style element ${index} contains fixed:`, style.innerHTML.includes('fixed'));
    console.log(`Style element ${index} content length:`, style.innerHTML.length);
  });
  
  const loginScreen = doc.getElementById('login-screen');
  if (loginScreen) {
    console.log('Login screen element classes:', loginScreen.className);
  } else {
    console.log('Login screen element not found!');
  }
}

test().catch(console.error);
