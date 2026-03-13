import React, { useState, useRef, useEffect } from 'react';
import { RISCVCore } from './riscv-core';
import { Assembler } from './assembler';
import { Play, StepForward, RotateCcw, Terminal, Cpu, Database, Code, Save, Upload, FileDown, FileUp, Binary } from 'lucide-react';

export default function App() {
  const [code, setCode] = useState<string>(
    "# Simple RISC-V Example\nLI x1, 10      # Load 10 into x1\nLI x2, 20      # Load 20 into x2\nADD x3, x1, x2 # x3 = x1 + x2\nADDI x4, x3, 5 # x4 = x3 + 5"
  );
  const [registers, setRegisters] = useState<Uint32Array>(new Uint32Array(32));
  const [pc, setPc] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>(["Emulator initialized."]);
  const [isRunning, setIsRunning] = useState(false);
  
  const coreRef = useRef(new RISCVCore());
  const runIntervalRef = useRef<number | null>(null);

  const updateState = () => {
    setRegisters(new Uint32Array(coreRef.current.registers));
    setPc(coreRef.current.pc);
  };

  const handleAssemble = () => {
    try {
      const machineCode = Assembler.parse(code);
      coreRef.current.loadProgram(machineCode);
      updateState();
      setLogs(prev => [...prev, "Assembled successfully. Program loaded."]);
    } catch (e) {
      setLogs(prev => [...prev, `Assembly Error: ${e}`]);
    }
  };

  const handleStep = () => {
    const result = coreRef.current.step();
    updateState();
    setLogs(prev => [...prev, result]);
  };

  const handleReset = () => {
    coreRef.current.reset();
    updateState();
    setLogs(["Emulator reset."]);
    if (isRunning) stopRun();
  };

  const saveAssembly = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.asm';
    a.click();
    URL.revokeObjectURL(url);
    setLogs(prev => [...prev, "Assembly saved to program.asm"]);
  };

  const loadAssembly = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCode(content);
      setLogs(prev => [...prev, `Loaded assembly: ${file.name}`]);
    };
    reader.readAsText(file);
  };

  const saveBinary = () => {
    try {
      const machineCode = Assembler.parse(code);
      const blob = new Blob([machineCode.buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'program.bin';
      a.click();
      URL.revokeObjectURL(url);
      setLogs(prev => [...prev, "Binary saved to program.bin"]);
    } catch (e) {
      setLogs(prev => [...prev, `Error generating binary: ${e}`]);
    }
  };

  const loadBinary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const machineCode = new Uint32Array(buffer);
      coreRef.current.loadProgram(machineCode);
      updateState();
      setLogs(prev => [...prev, `Loaded binary: ${file.name}`]);
    };
    reader.readAsArrayBuffer(file);
  };

  const startRun = () => {
    setIsRunning(true);
    runIntervalRef.current = window.setInterval(() => {
      const result = coreRef.current.step();
      updateState();
      if (result.includes("HALT") || result.includes("End")) {
        stopRun();
        setLogs(prev => [...prev, result]);
      }
    }, 100);
  };

  const stopRun = () => {
    setIsRunning(false);
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
  };

  const toggleRun = () => {
    if (isRunning) stopRun();
    else startRun();
  };

  // ABI names for registers
  const abiNames = [
    'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
    's0/fp', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
    'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
    's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
  ];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8">
      <header className="mb-8 border-b border-[#141414] pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase italic font-serif">RV32I Emulator</h1>
          <p className="text-xs opacity-60 uppercase tracking-widest mt-1">RISC-V Base Integer Instruction Set</p>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Section */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] p-4 flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-3 border-b border-[#141414] pb-2">
              <div className="flex items-center gap-2">
                <Code size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Assembly Editor</span>
              </div>
              <div className="flex gap-1">
                <label className="cursor-pointer px-2 py-1 bg-white border border-[#141414] text-[#141414] text-[10px] font-bold uppercase hover:bg-gray-100 transition-all flex items-center gap-1" title="Load ASM">
                  <FileUp size={12} />
                  <input type="file" accept=".asm,.s,.txt" onChange={loadAssembly} className="hidden" />
                </label>
                <button onClick={saveAssembly} className="px-2 py-1 bg-white border border-[#141414] text-[#141414] text-[10px] font-bold uppercase hover:bg-gray-100 transition-all flex items-center gap-1" title="Save ASM">
                  <FileDown size={12} />
                </button>
                <button 
                  onClick={handleAssemble}
                  className="ml-2 px-3 py-1 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest hover:bg-opacity-80 transition-all flex items-center gap-2"
                >
                  <Code size={12} /> Assemble & Load
                </button>
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 font-mono text-sm p-2 outline-none resize-none bg-transparent"
              spellCheck={false}
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={toggleRun}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest border border-[#141414] transition-all ${isRunning ? 'bg-red-500 text-white' : 'bg-[#141414] text-[#E4E3E0]'}`}
            >
              <Play size={14} fill="currentColor" /> {isRunning ? 'Stop' : 'Run'}
            </button>
            <button 
              onClick={handleStep}
              className="flex-1 py-3 bg-white border border-[#141414] text-[#141414] text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all flex items-center justify-center gap-2"
            >
              <StepForward size={14} /> Step
            </button>
            <button 
              onClick={handleReset}
              className="px-4 py-3 bg-white border border-[#141414] text-[#141414] text-xs font-bold uppercase tracking-widest hover:bg-red-100 transition-all"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Registers Section */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] p-4 h-full">
            <div className="flex items-center justify-between mb-3 border-b border-[#141414] pb-2">
              <div className="flex items-center gap-2">
                <Cpu size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Registers</span>
              </div>
              <div className="text-[10px] font-mono opacity-50">
                PC: 0x{pc.toString(16).padStart(8, '0')}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto max-h-[550px] pr-2 custom-scrollbar">
              {Array.from(registers).map((val, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] border-b border-[#141414]/10 py-1 hover:bg-[#141414]/5 px-1">
                  <div className="flex gap-2">
                    <span className="font-bold w-6">x{i}</span>
                    <span className="opacity-40 italic w-12">{abiNames[i]}</span>
                  </div>
                  <div className="font-mono flex gap-3">
                    <span className="text-blue-700">0x{(val as number).toString(16).padStart(8, '0')}</span>
                    <span className="w-12 text-right">{val}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Console / Memory Section */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-[#141414] text-[#E4E3E0] p-4 flex flex-col h-[300px] border border-[#141414]">
            <div className="flex items-center gap-2 mb-3 border-b border-[#E4E3E0]/20 pb-2">
              <Terminal size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Console Output</span>
            </div>
            <div className="flex-1 font-mono text-[10px] overflow-y-auto flex flex-col-reverse gap-1 pr-2 custom-scrollbar">
              {[...logs].reverse().map((log, i) => (
                <div key={i} className="opacity-80 border-l border-[#E4E3E0]/20 pl-2 py-0.5">
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#141414] p-4 flex flex-col flex-1 min-h-[200px]">
            <div className="flex items-center justify-between mb-3 border-b border-[#141414] pb-2">
              <div className="flex items-center gap-2">
                <Database size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Memory (First 64 Bytes)</span>
              </div>
              <div className="flex gap-1">
                <label className="cursor-pointer px-1.5 py-0.5 bg-white border border-[#141414] text-[#141414] text-[9px] font-bold uppercase hover:bg-gray-100 transition-all flex items-center gap-1" title="Load BIN">
                  <Upload size={10} />
                  <input type="file" accept=".bin" onChange={loadBinary} className="hidden" />
                </label>
                <button onClick={saveBinary} className="px-1.5 py-0.5 bg-white border border-[#141414] text-[#141414] text-[9px] font-bold uppercase hover:bg-gray-100 transition-all flex items-center gap-1" title="Save BIN">
                  <Save size={10} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 font-mono text-[10px]">
              {Array.from(coreRef.current.memory.slice(0, 64)).map((byte, i) => (
                <div key={i} className={`p-1 text-center border ${byte !== 0 ? 'bg-yellow-50 border-yellow-200' : 'border-gray-100 opacity-30'}`}>
                  {(byte as number).toString(16).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #141414;
        }
      `}} />
    </div>
  );
}
