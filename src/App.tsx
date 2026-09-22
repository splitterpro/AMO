import Header from './components/Header'
import CsvUpload from './components/CsvUpload'
import './App.css'

function App() {
  return (
    <>
      <Header />
      <main className="page">
        <CsvUpload />
      </main>
    </>
  )
}

export default App
