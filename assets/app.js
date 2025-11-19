document.getElementById("loadBtn").addEventListener("click",()=>loadPosts(true));

let after=null;

async function loadPosts(reset){
 const input=document.getElementById("userInput").value.trim();
 const mode=document.getElementById("modeSelect").value;
 const status=document.getElementById("status");
 const app=document.getElementById("app");

 if(reset){ app.innerHTML=""; after=null; }

 if(!input){ alert("Enter a value"); return; }

 let url = (mode==="u")
  ? `https://www.reddit.com/user/${input}/submitted.json?limit=20`
  : `https://www.reddit.com/r/${input}/hot.json?limit=20`;

 if(after) url+=`&after=${after}`;

 status.textContent="Loading… v007b";

 const data=await fetch(url).then(r=>r.json());
 const posts=data.data.children||[];
 after=data.data.after;

 status.textContent=`Loaded ${posts.length} posts • v007b`;

 posts.forEach(p=>{
  const d=p.data;
  const card=document.createElement("div");
  card.className="post";
  card.innerHTML=`<div class="post-title">${d.title}</div>`;

  let media=null;

  const isVid=d.is_video&&d.media?.reddit_video;
  const isGif=d.url.endsWith(".gif")||d.url.endsWith(".gifv");
  const isMp4=d.url.endsWith(".mp4");

  if(isVid||isGif||isMp4){
    const videoUrl=isVid?d.media.reddit_video.fallback_url:d.url.replace(".gifv",".mp4");
    const thumb=d.thumbnail&&d.thumbnail!=="default"?d.thumbnail:(d.preview?.images?.[0]?.source?.url||"");

    media=document.createElement("img");
    media.className="thumb video-thumb";
    media.dataset.src=videoUrl;
    media.src=thumb||"https://i.redd.it/no_thumbnail.png";

    setupHover(media);
    setupClick(media);
  } else if(d.url.match(/\.(jpg|png|jpeg)$/i)){
    media=document.createElement("img");
    media.className="thumb";
    media.src=d.url;
  }

  if(media) card.appendChild(media);
  app.appendChild(card);
 });
}

function setupHover(thumb){
 let vid=null;
 thumb.addEventListener("mouseenter",()=>{
  vid=document.createElement("video");
  vid.src=thumb.dataset.src;
  vid.autoplay=true; vid.muted=true; vid.loop=true;
  vid.className="inlineVideo";
  thumb.replaceWith(vid);
 });
 thumb.addEventListener("mouseleave",()=>{
  if(!vid) return;
  vid.pause(); vid.replaceWith(thumb); vid=null;
 });
}

function setupClick(thumb){
 thumb.addEventListener("click",()=>openVideoModal(thumb.dataset.src));
}

const modal=document.getElementById("videoModal");
const modalVideo=document.getElementById("modalVideo");

function openVideoModal(src){
 modalVideo.src=src;
 modal.classList.remove("hidden");
 modalVideo.play();
}

modal.addEventListener("click",e=>{
 if(e.target===modal){
  modalVideo.pause();
  modalVideo.src="";
  modal.classList.add("hidden");
 }
});

window.addEventListener("scroll",()=>{
 const btn=document.getElementById("scrollTopBtn");
 if(window.scrollY>300) btn.style.display="block";
 else btn.style.display="none";
});

document.getElementById("scrollTopBtn").onclick=()=>{
 window.scrollTo({top:0,behavior:"smooth"});
};