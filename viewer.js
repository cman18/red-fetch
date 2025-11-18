async function load() {
  const url = 'https://www.reddit.com/r/pics/hot.json?limit=10';
  const r = await fetch(url).then(r=>r.json());
  const posts = document.getElementById('posts');
  posts.innerHTML='';
  r.data.children.forEach(p=>{
    const d=p.data;
    const card=document.createElement('div');
    card.className='post-card';
    const t=document.createElement('div');
    t.className='post-title';
    t.textContent=d.title;
    card.appendChild(t);
    const m=document.createElement('div');
    m.className='media-container';
    if(d.url.endsWith('.jpg')||d.url.endsWith('.png')){
      const img=document.createElement('img');
      img.src=d.url;
      m.appendChild(img);
    }
    card.appendChild(m);
    posts.appendChild(card);
  });
}
load();
