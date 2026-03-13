/**
 * RV32I RISC-V CPU Core
 * Implements Fetch-Decode-Execute cycle for RV32I base integer instruction set.
 */

export class RISCVCore {
  public registers: Uint32Array = new Uint32Array(32);
  public pc: number = 0;
  public memory: Uint8Array = new Uint8Array(1024 * 64); // 64KB memory
  public isRunning: boolean = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.registers.fill(0);
    this.pc = 0;
    this.isRunning = false;
  }

  // Load program into memory starting at address 0
  loadProgram(program: Uint32Array) {
    this.reset();
    for (let i = 0; i < program.length; i++) {
      const addr = i * 4;
      this.memory[addr] = program[i] & 0xff;
      this.memory[addr + 1] = (program[i] >> 8) & 0xff;
      this.memory[addr + 2] = (program[i] >> 16) & 0xff;
      this.memory[addr + 3] = (program[i] >> 24) & 0xff;
    }
  }

  // Immediate Decoders
  private decodeIImm(instr: number): number {
    return (instr >> 20); // Sign-extended 12-bit
  }

  private decodeSImm(instr: number): number {
    const imm11_5 = (instr >> 25) & 0x7f;
    const imm4_0 = (instr >> 7) & 0x1f;
    const imm = (imm11_5 << 5) | imm4_0;
    return (imm << 20) >> 20; // Sign-extend 12-bit to 32-bit
  }

  private decodeBImm(instr: number): number {
    const imm12 = (instr >> 31) & 0x1;
    const imm11 = (instr >> 7) & 0x1;
    const imm10_5 = (instr >> 25) & 0x3f;
    const imm4_1 = (instr >> 8) & 0xf;
    const imm = (imm12 << 12) | (imm11 << 11) | (imm10_5 << 5) | (imm4_1 << 1);
    return (imm << 19) >> 19; // Sign-extend 13-bit to 32-bit
  }

  private decodeUImm(instr: number): number {
    return instr & 0xfffff000; // Upper 20 bits
  }

  private decodeJImm(instr: number): number {
    const imm20 = (instr >> 31) & 0x1;
    const imm19_12 = (instr >> 12) & 0xff;
    const imm11 = (instr >> 20) & 0x1;
    const imm10_1 = (instr >> 21) & 0x3ff;
    const imm = (imm20 << 20) | (imm19_12 << 12) | (imm11 << 11) | (imm10_1 << 1);
    return (imm << 11) >> 11; // Sign-extend 21-bit to 32-bit
  }

  step(): string {
    if (this.pc >= this.memory.length - 4) {
      return "End of memory reached";
    }

    // Fetch
    const instruction =
      this.memory[this.pc] |
      (this.memory[this.pc + 1] << 8) |
      (this.memory[this.pc + 2] << 16) |
      (this.memory[this.pc + 3] << 24);

    if (instruction === 0) {
      return "HALT (0x00000000)";
    }

    // Decode
    const opcode = instruction & 0x7f;
    const rd = (instruction >> 7) & 0x1f;
    const funct3 = (instruction >> 12) & 0x07;
    const rs1 = (instruction >> 15) & 0x1f;
    const rs2 = (instruction >> 20) & 0x1f;
    const funct7 = (instruction >> 25) & 0x7f;

    let debugInfo = `PC: 0x${this.pc.toString(16).padStart(8, '0')} | Instr: 0x${instruction.toString(16).padStart(8, '0')} | `;
    let nextPc = this.pc + 4;

    switch (opcode) {
      case 0x37: { // LUI
        const imm = this.decodeUImm(instruction);
        this.registers[rd] = imm;
        debugInfo += `LUI x${rd}, ${imm}`;
        break;
      }
      case 0x17: { // AUIPC
        const imm = this.decodeUImm(instruction);
        this.registers[rd] = this.pc + imm;
        debugInfo += `AUIPC x${rd}, ${imm}`;
        break;
      }
      case 0x6f: { // JAL
        const imm = this.decodeJImm(instruction);
        this.registers[rd] = this.pc + 4;
        nextPc = this.pc + imm;
        debugInfo += `JAL x${rd}, ${imm}`;
        break;
      }
      case 0x67: { // JALR
        const imm = this.decodeIImm(instruction);
        this.registers[rd] = this.pc + 4;
        nextPc = (this.registers[rs1] + imm) & ~1;
        debugInfo += `JALR x${rd}, x${rs1}, ${imm}`;
        break;
      }
      case 0x63: { // BRANCH
        const imm = this.decodeBImm(instruction);
        const val1 = this.registers[rs1];
        const val2 = this.registers[rs2];
        let take = false;
        switch (funct3) {
          case 0x0: take = val1 === val2; debugInfo += `BEQ`; break;
          case 0x1: take = val1 !== val2; debugInfo += `BNE`; break;
          case 0x4: take = (val1 | 0) < (val2 | 0); debugInfo += `BLT`; break;
          case 0x5: take = (val1 | 0) >= (val2 | 0); debugInfo += `BGE`; break;
          case 0x6: take = val1 < val2; debugInfo += `BLTU`; break;
          case 0x7: take = val1 >= val2; debugInfo += `BGEU`; break;
        }
        if (take) nextPc = this.pc + imm;
        debugInfo += ` x${rs1}, x${rs2}, ${imm}`;
        break;
      }
      case 0x03: { // LOAD
        const imm = this.decodeIImm(instruction);
        const addr = this.registers[rs1] + imm;
        switch (funct3) {
          case 0x0: // LB
            this.registers[rd] = (this.memory[addr] << 24) >> 24;
            debugInfo += `LB`;
            break;
          case 0x1: // LH
            this.registers[rd] = ((this.memory[addr] | (this.memory[addr + 1] << 8)) << 16) >> 16;
            debugInfo += `LH`;
            break;
          case 0x2: // LW
            this.registers[rd] = this.memory[addr] | (this.memory[addr + 1] << 8) | (this.memory[addr + 2] << 16) | (this.memory[addr + 3] << 24);
            debugInfo += `LW`;
            break;
          case 0x4: // LBU
            this.registers[rd] = this.memory[addr];
            debugInfo += `LBU`;
            break;
          case 0x5: // LHU
            this.registers[rd] = this.memory[addr] | (this.memory[addr + 1] << 8);
            debugInfo += `LHU`;
            break;
        }
        debugInfo += ` x${rd}, ${imm}(x${rs1})`;
        break;
      }
      case 0x23: { // STORE
        const imm = this.decodeSImm(instruction);
        const addr = this.registers[rs1] + imm;
        const val = this.registers[rs2];
        switch (funct3) {
          case 0x0: // SB
            this.memory[addr] = val & 0xff;
            debugInfo += `SB`;
            break;
          case 0x1: // SH
            this.memory[addr] = val & 0xff;
            this.memory[addr + 1] = (val >> 8) & 0xff;
            debugInfo += `SH`;
            break;
          case 0x2: // SW
            this.memory[addr] = val & 0xff;
            this.memory[addr + 1] = (val >> 8) & 0xff;
            this.memory[addr + 2] = (val >> 16) & 0xff;
            this.memory[addr + 3] = (val >> 24) & 0xff;
            debugInfo += `SW`;
            break;
        }
        debugInfo += ` x${rs2}, ${imm}(x${rs1})`;
        break;
      }
      case 0x13: { // OP-IMM
        const imm = this.decodeIImm(instruction);
        const val1 = this.registers[rs1];
        switch (funct3) {
          case 0x0: this.registers[rd] = val1 + imm; debugInfo += `ADDI`; break;
          case 0x2: this.registers[rd] = (val1 | 0) < (imm | 0) ? 1 : 0; debugInfo += `SLTI`; break;
          case 0x3: this.registers[rd] = val1 < (imm >>> 0) ? 1 : 0; debugInfo += `SLTIU`; break;
          case 0x4: this.registers[rd] = val1 ^ imm; debugInfo += `XORI`; break;
          case 0x6: this.registers[rd] = val1 | imm; debugInfo += `ORI`; break;
          case 0x7: this.registers[rd] = val1 & imm; debugInfo += `ANDI`; break;
          case 0x1: this.registers[rd] = val1 << (imm & 0x1f); debugInfo += `SLLI`; break;
          case 0x5:
            if ((imm >> 5) === 0x00) {
              this.registers[rd] = val1 >>> (imm & 0x1f);
              debugInfo += `SRLI`;
            } else {
              this.registers[rd] = val1 >> (imm & 0x1f);
              debugInfo += `SRAI`;
            }
            break;
        }
        debugInfo += ` x${rd}, x${rs1}, ${imm}`;
        break;
      }
      case 0x33: { // OP
        const val1 = this.registers[rs1];
        const val2 = this.registers[rs2];
        switch (funct3) {
          case 0x0:
            if (funct7 === 0x00) { this.registers[rd] = val1 + val2; debugInfo += `ADD`; }
            else { this.registers[rd] = val1 - val2; debugInfo += `SUB`; }
            break;
          case 0x1: this.registers[rd] = val1 << (val2 & 0x1f); debugInfo += `SLL`; break;
          case 0x2: this.registers[rd] = (val1 | 0) < (val2 | 0) ? 1 : 0; debugInfo += `SLT`; break;
          case 0x3: this.registers[rd] = val1 < val2 ? 1 : 0; debugInfo += `SLTU`; break;
          case 0x4: this.registers[rd] = val1 ^ val2; debugInfo += `XOR`; break;
          case 0x5:
            if (funct7 === 0x00) { this.registers[rd] = val1 >>> (val2 & 0x1f); debugInfo += `SRL`; }
            else { this.registers[rd] = val1 >> (val2 & 0x1f); debugInfo += `SRA`; }
            break;
          case 0x6: this.registers[rd] = val1 | val2; debugInfo += `OR`; break;
          case 0x7: this.registers[rd] = val1 & val2; debugInfo += `AND`; break;
        }
        debugInfo += ` x${rd}, x${rs1}, x${rs2}`;
        break;
      }
      default:
        debugInfo += `Unknown Opcode: 0x${opcode.toString(16)}`;
        break;
    }

    // Ensure x0 is always 0
    this.registers[0] = 0;
    
    // Update PC
    this.pc = nextPc;

    return debugInfo;
  }
}
