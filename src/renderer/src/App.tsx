import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import { useState } from 'react'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  const backendPort = process.env.VITE_BACKEND_PORT

  const [data, setData] = useState('')

  const fetchData = async (): Promise<void> => {
    try {
      const response = await fetch(`http://localhost:${backendPort}/data`)
      const jsonData = await response.json()
      setData(jsonData.message)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite and python</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
        &nbsp;and <span className="ts">Python</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
        <div className="action">
          <a onClick={fetchData} style={{ cursor: 'pointer' }}>{data || 'Click me'}</a>
        </div>
      </div>
      <Versions></Versions>
    </>
  )
}

export default App
