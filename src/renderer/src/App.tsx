import { useState, useEffect } from 'react'
import DashboardPage from '@renderer/dashboard/page'
import OPCServerPage from '@renderer/opc-server/page'
import { ThemeProvider } from "@/components/theme-provider"

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'opc-server'>('dashboard')

  useEffect(() => {
    const handleNavigation = (event: CustomEvent) => {
      setCurrentPage(event.detail.page)
    }

    window.addEventListener('navigate' as any, handleNavigation as EventListener)
    return () => window.removeEventListener('navigate' as any, handleNavigation as EventListener)
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'opc-server':
        return <OPCServerPage />
      case 'dashboard':
      default:
        return <DashboardPage />
    }
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {renderPage()}
    </ThemeProvider >
  )
  // const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  // const backendPort = process.env.VITE_BACKEND_PORT

  // const [data, setData] = useState('')

  // const fetchData = async (): Promise<void> => {
  //   try {
  //     const response = await fetch(`http://localhost:${backendPort}/data`)
  //     const jsonData = await response.json()
  //     setData(jsonData.message)
  //   } catch (error) {
  //     console.error('Error fetching data:', error)
  //   }
  // }

  // return (
  //   <>
  //     <img alt="logo" src={electronLogo} />
  //     <div >Powered by electron-vite and python</div>
  //     <div>
  //       Build an Electron app with <span>React</span>
  //       &nbsp;and <span>TypeScript</span>
  //       &nbsp;and <span>Python</span>
  //     </div>
  //     <p>
  //       Please try pressing <code>F12</code> to open the devTool
  //     </p>
  //     <div>
  //       <div>
  //         <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
  //           Documentation
  //         </a>
  //       </div>
  //       <div>
  //         <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
  //           Send IPC
  //         </a>
  //       </div>
  //       <div>
  //         <a onClick={fetchData} style={{ cursor: 'pointer' }}>{data || 'Click me'}</a>
  //       </div>
  //     </div>
  //     <Button onClick={ipcHandle}>Ping</Button>
  //   </>
  // )
}

export default App
