import { CSSProperties, useState } from "react";
import axios from "axios";
import Link from "next/link";



export default function Home() {


  





  const [url,setUrl]  = useState('http://via.placeholder.com/1200x1200');
  const [title,setTitle]  = useState('Filmclub Podcast');
  const [number,setNumber]  = useState('00')

  const fetchImage = async () => {
    const FetchUrl = 'https://api.themoviedb.org/3/search/movie?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb&query=' + encodeURIComponent(title)
    
    const response = await fetch(FetchUrl);
    

    const d = await response.json();
    if(d.total_results!=0){
      //const id= Math.floor(Math.random() * d.total_results) + 0
      //console.log(id + ' / ' + d.total_results)
      const link = d.results[0].backdrop_path;
    return 'https://image.tmdb.org/t/p/original'+link
    }
    else{
      return 'http://via.placeholder.com/1200x1200'
    }
    
}

  const openInNewTab = (l) => {
    const newWindow = window.open('/api/og?title='+encodeURIComponent(title)+'&number='+encodeURIComponent(number)+'&url='+encodeURIComponent(l), '_blank', 'noopener,noreferrer')
    if (newWindow) newWindow.opener = null
  }
  const inputStyle:CSSProperties = {
    height: '1.25em',
    position:'relative', 
    fontSize: '1.8em',
    textAlign:'center',
    border: '0',
    outline: '0',
    color: '#fff',
    background: 'transparent',
    left:'50%',
    transform: 'translate(-50%,0)',
    marginTop: '1em',
    marginBottom: '1em',
    fontFamily: '"Bebas Neue", Arial',
    verticalAlign: 'middle',
  } 
  const divStyle = {
    height: '6.25em',
    width: '100%',
    display: 'flex',}
  const handleGenerate =  async (event) => {
    event.preventDefault(); 
    setUrl('http://via.placeholder.com/1200x1200')
    if(url=='http://via.placeholder.com/1200x1200'){
      fetchImage().then((d) => { 
        console.log(url)
         setUrl(d);openInNewTab(d); })
  
    }
    else{
      openInNewTab(url)
    }
    
   
}
  return (
    <>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh'}}>
    
      <form style={{
        height: '18.75em',
        width: '30em',
        background: '#fff',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        textTransform: 'uppercase',
        fontFamily: '"Bebas Neue", Arial',
        color: '#fff',
      }}>
      <h3 style={{color:'darkgray',textAlign:'center',verticalAlign:'middle',marginTop:'2em',marginBottom:'2em'}} >Cover Generator</h3>
     <div  style={{backgroundColor:'#4daf7c',}}> <input style={inputStyle} placeholder="Filmclub Podcast" value={title} type="text" onChange={({target}) => setTitle(target.value)}></input></div>
     <div  style={{backgroundColor:'#404241',...divStyle}}> <input style={inputStyle} placeholder="0" value={number} type="number" onChange={({target}) => setNumber(target.value)}></input></div>
     <div  style={{backgroundColor:'#e9c85d',...divStyle}}> <input style={inputStyle}placeholder="Bild url (optional)" value={url} type="url" onChange={({target}) => setUrl(target.value)}></input></div>
     <div style={{backgroundColor:'#A30000',...divStyle}}><span
  style={{
    display:'inline-block',
    marginLeft: '3.3em',
    marginTop: '1em',
    marginBottom: '1em',
    
    height: '1.25em',
    width: '9em',
    fontSize: '2em',
    textAlign:'center',
    border: '0',
    outline: '0',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }} onClick={handleGenerate }>Generieren</span>
</div>
      
      </form>
   </div>
    </>
  )
}
