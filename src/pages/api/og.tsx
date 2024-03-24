import { ImageResponse } from '@vercel/og';
import Link from 'next/link';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};
// ...Vercel Edge functions config object

// Make sure the font exists in the specified path:
const font = fetch(new URL('../../assets/Anton-Regular.ttf', import.meta.url)).then(
  (res) => res.arrayBuffer(),
);
  
  
  
  // ...exported function
  export default async function (req: NextRequest) {
    const fontData = await font;
    
    try {
      // 1: get the searchParams from the request URL
      const { searchParams } = new URL(req.url)
  
      // 2: Check if title or description are in the params
      const hasTitle = searchParams.has('title')
      const hasNumber = searchParams.has('number')
      const hasUrl = searchParams.has('url')
      const hasFit = searchParams.has('fit')
      
  
      // 3: If so, take the passed value. If not, assign a default
      const title = hasTitle
        ? searchParams.get('title')
        : 'Some title'

    
           
       

        const imageContentStyle = {
            objectFit: hasFit
            ? searchParams.get('fit')
            :  'cover',
          } as React.CSSProperties;
        
        const image = hasUrl
        ? searchParams.get('url')
        :  'http://via.placeholder.com/1200x1200'; 
          
      const number = hasNumber
        ? searchParams.get('number')
        : '00'

 
  return new ImageResponse(
    
    (
    <div
        style={{
          backgroundColor:'#1F1F1F',
          width: '100%',
          height: '100%',
          display:'flex',
          textAlign: 'center',
          //alignItems: 'flex-start',
          //justifyContent: 'flex-start',
          position: 'relative',
          objectFit: 'cover',
        }}
    >
        
        <img
        id='image'
          alt="d"
          
          src={`${image}`}
           style={{
            filter: 'brightness(50%) grayscale(100%)',
            position: 'absolute',
            display:'flex',
            left:'0',
            width:'1200',
            height:'1200',
            ...imageContentStyle
          }}
        />

        <div
            style={{
                top:'0',
                left:'50px',
                display: 'flex',
                flexDirection: 'column',
                position:'absolute',
            }}
            >
            <h1
                    style={{
                    fontSize: 152,
                    fontFamily: 'Anton',
                    color: '#E3C368',
                    marginBottom: 0,
                    fontWeight: 900,
                    }}
                >
                    {title}
            </h1>
            
        </div>

        <div
          style={{
            marginTop:'auto',
            marginBottom:'auto',
            position: 'absolute',
            display:'flex',
            verticalAlign:'middle',
            justifyContent: 'center',
           bottom:'80px',
           right:'-240px',
            transform: 'rotate(-45deg)',
			backgroundColor: '#E3C368',
            width:'800px',
            height:'120px',
          }}
        >
        <p
            style={{
            
                
              fontFamily: 'Anton',
              fontSize: 60,
              color: '#1F1F1F',
              fontWeight: 700,
              
            }}
          >
           {number}
        </p>
        </div>
    </div>
  
      
    ),
    {
      width: 1200,
      height: 1200,
      fonts: [
        {
          name: 'Anton',
          data: fontData,
          style: 'normal',
        },
      ],
    }
    ) 
   
  } catch (e) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}