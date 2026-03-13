/**
 * Simple RISC-V Assembler
 * Parses RV32I assembly strings into machine code.
 */

export class Assembler {
  static parse(text: string): Uint32Array {
    const lines = text.split('\n');
    const machineCode: number[] = [];
    const labels: { [key: string]: number } = {};
    const instructions: string[] = [];

    // First pass: Find labels and collect instructions
    let currentAddr = 0;
    for (let line of lines) {
      line = line.split('#')[0].trim();
      if (!line) continue;

      if (line.endsWith(':')) {
        const labelName = line.slice(0, -1).trim();
        labels[labelName] = currentAddr;
      } else {
        instructions.push(line);
        currentAddr += 4;
      }
    }

    // Second pass: Encode instructions
    currentAddr = 0;
    for (let line of instructions) {
      const parts = line.replace(/,/g, ' ').replace(/\(/g, ' ').replace(/\)/g, ' ').split(/\s+/).filter(p => p !== '');
      const instr = parts[0].toUpperCase();

      try {
        let encoded = 0;
        switch (instr) {
          // R-type
          case 'ADD':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x0, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'SUB':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x0, this.reg(parts[2]), this.reg(parts[3]), 0x20); break;
          case 'SLL':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x1, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'SLT':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x2, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'SLTU': encoded = this.encodeR(0x33, this.reg(parts[1]), 0x3, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'XOR':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x4, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'SRL':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x5, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'SRA':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x5, this.reg(parts[2]), this.reg(parts[3]), 0x20); break;
          case 'OR':   encoded = this.encodeR(0x33, this.reg(parts[1]), 0x6, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;
          case 'AND':  encoded = this.encodeR(0x33, this.reg(parts[1]), 0x7, this.reg(parts[2]), this.reg(parts[3]), 0x00); break;

          // I-type (Arithmetic)
          case 'ADDI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x0, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'SLTI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x2, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'SLTIU': encoded = this.encodeI(0x13, this.reg(parts[1]), 0x3, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'XORI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x4, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'ORI':   encoded = this.encodeI(0x13, this.reg(parts[1]), 0x6, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'ANDI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x7, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'SLLI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x1, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr) & 0x1f); break;
          case 'SRLI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x5, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr) & 0x1f); break;
          case 'SRAI':  encoded = this.encodeI(0x13, this.reg(parts[1]), 0x5, this.reg(parts[2]), (this.imm(parts[3], labels, currentAddr) & 0x1f) | 0x400); break;

          // I-type (Loads)
          case 'LB':  encoded = this.encodeI(0x03, this.reg(parts[1]), 0x0, this.reg(parts[3]), this.imm(parts[2], labels, currentAddr)); break;
          case 'LH':  encoded = this.encodeI(0x03, this.reg(parts[1]), 0x1, this.reg(parts[3]), this.imm(parts[2], labels, currentAddr)); break;
          case 'LW':  encoded = this.encodeI(0x03, this.reg(parts[1]), 0x2, this.reg(parts[3]), this.imm(parts[2], labels, currentAddr)); break;
          case 'LBU': encoded = this.encodeI(0x03, this.reg(parts[1]), 0x4, this.reg(parts[3]), this.imm(parts[2], labels, currentAddr)); break;
          case 'LHU': encoded = this.encodeI(0x03, this.reg(parts[1]), 0x5, this.reg(parts[3]), this.imm(parts[2], labels, currentAddr)); break;

          // S-type (Stores)
          case 'SB': encoded = this.encodeS(0x23, 0x0, this.reg(parts[3]), this.reg(parts[1]), this.imm(parts[2], labels, currentAddr)); break;
          case 'SH': encoded = this.encodeS(0x23, 0x1, this.reg(parts[3]), this.reg(parts[1]), this.imm(parts[2], labels, currentAddr)); break;
          case 'SW': encoded = this.encodeS(0x23, 0x2, this.reg(parts[3]), this.reg(parts[1]), this.imm(parts[2], labels, currentAddr)); break;

          // B-type (Branches)
          case 'BEQ':  encoded = this.encodeB(0x63, 0x0, this.reg(parts[1]), this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'BNE':  encoded = this.encodeB(0x63, 0x1, this.reg(parts[1]), this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'BLT':  encoded = this.encodeB(0x63, 0x4, this.reg(parts[1]), this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'BGE':  encoded = this.encodeB(0x63, 0x5, this.reg(parts[1]), this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'BLTU': encoded = this.encodeB(0x63, 0x6, this.reg(parts[1]), this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;
          case 'BGEU': encoded = this.encodeB(0x63, 0x7, this.reg(parts[1]), this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;

          // U-type
          case 'LUI':   encoded = this.encodeU(0x37, this.reg(parts[1]), this.imm(parts[2], labels, currentAddr)); break;
          case 'AUIPC': encoded = this.encodeU(0x17, this.reg(parts[1]), this.imm(parts[2], labels, currentAddr)); break;

          // J-type
          case 'JAL': encoded = this.encodeJ(0x6f, this.reg(parts[1]), this.imm(parts[2], labels, currentAddr)); break;
          case 'JALR': encoded = this.encodeI(0x67, this.reg(parts[1]), 0x0, this.reg(parts[2]), this.imm(parts[3], labels, currentAddr)); break;

          // Pseudo-instructions
          case 'LI': encoded = this.encodeI(0x13, this.reg(parts[1]), 0x0, 0, this.imm(parts[2], labels, currentAddr)); break;
          case 'MV': encoded = this.encodeI(0x13, this.reg(parts[1]), 0x0, this.reg(parts[2]), 0); break;
          case 'J':  encoded = this.encodeJ(0x6f, 0, this.imm(parts[1], labels, currentAddr)); break;
          case 'JR': encoded = this.encodeI(0x67, 0, 0, this.reg(parts[1]), 0); break;
          case 'RET': encoded = this.encodeI(0x67, 0, 0, 1, 0); break; // JALR x0, x1, 0

          default: throw new Error(`Unknown instruction: ${instr}`);
        }
        machineCode.push(encoded);
        currentAddr += 4;
      } catch (e) {
        console.error(`Error parsing line: ${line}`, e);
        throw e;
      }
    }

    return new Uint32Array(machineCode);
  }

  private static reg(reg: string): number {
    reg = reg.toLowerCase();
    if (reg.startsWith('x')) return parseInt(reg.substring(1));
    const abi: { [key: string]: number } = {
      'zero': 0, 'ra': 1, 'sp': 2, 'gp': 3, 'tp': 4,
      't0': 5, 't1': 6, 't2': 7, 's0': 8, 'fp': 8, 's1': 9,
      'a0': 10, 'a1': 11, 'a2': 12, 'a3': 13, 'a4': 14, 'a5': 15, 'a6': 16, 'a7': 17,
      's2': 18, 's3': 19, 's4': 20, 's5': 21, 's6': 22, 's7': 23, 's8': 24, 's9': 25, 's10': 26, 's11': 27,
      't3': 28, 't4': 29, 't5': 30, 't6': 31
    };
    if (abi[reg] !== undefined) return abi[reg];
    throw new Error(`Invalid register: ${reg}`);
  }

  private static imm(val: string, labels: { [key: string]: number }, currentAddr: number): number {
    if (labels[val] !== undefined) {
      return labels[val] - currentAddr;
    }
    return parseInt(val);
  }

  private static encodeR(opcode: number, rd: number, funct3: number, rs1: number, rs2: number, funct7: number): number {
    return (opcode & 0x7f) | ((rd & 0x1f) << 7) | ((funct3 & 0x07) << 12) | ((rs1 & 0x1f) << 15) | ((rs2 & 0x1f) << 20) | ((funct7 & 0x7f) << 25);
  }

  private static encodeI(opcode: number, rd: number, funct3: number, rs1: number, imm: number): number {
    return (opcode & 0x7f) | ((rd & 0x1f) << 7) | ((funct3 & 0x07) << 12) | ((rs1 & 0x1f) << 15) | ((imm & 0xfff) << 20);
  }

  private static encodeS(opcode: number, funct3: number, rs1: number, rs2: number, imm: number): number {
    return (opcode & 0x7f) | ((imm & 0x1f) << 7) | ((funct3 & 0x07) << 12) | ((rs1 & 0x1f) << 15) | ((rs2 & 0x1f) << 20) | (((imm >> 5) & 0x7f) << 25);
  }

  private static encodeB(opcode: number, funct3: number, rs1: number, rs2: number, imm: number): number {
    const b11 = (imm >> 11) & 0x1;
    const b4_1 = (imm >> 1) & 0xf;
    const b10_5 = (imm >> 5) & 0x3f;
    const b12 = (imm >> 12) & 0x1;
    return (opcode & 0x7f) | (b11 << 7) | (b4_1 << 8) | ((funct3 & 0x07) << 12) | ((rs1 & 0x1f) << 15) | ((rs2 & 0x1f) << 20) | (b10_5 << 25) | (b12 << 31);
  }

  private static encodeU(opcode: number, rd: number, imm: number): number {
    return (opcode & 0x7f) | ((rd & 0x1f) << 7) | (imm & 0xfffff000);
  }

  private static encodeJ(opcode: number, rd: number, imm: number): number {
    const b19_12 = (imm >> 12) & 0xff;
    const b11 = (imm >> 11) & 0x1;
    const b10_1 = (imm >> 1) & 0x3ff;
    const b20 = (imm >> 20) & 0x1;
    return (opcode & 0x7f) | ((rd & 0x1f) << 7) | (b19_12 << 12) | (b11 << 20) | (b10_1 << 21) | (b20 << 31);
  }
}
