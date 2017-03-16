Setup
=====

1. Install Node 7
2. Open ports UDP 53 and TCP 80 and 8081 on your firewall
3. Run `npm install`
4. Start everything with `npm start`
5. Point your Switch to the DNS server
6. Go to the eShop or another area that will trigger the captive portal
7. Watch the shell connect

Shell
=====

The default way to work with PegaSwitch is via the shell.  Type `help` after the Switch connects to get a list of commands.

![shell help](https://i.imgur.com/qlfEhRJ.png)
![shell output](https://pegaswitch.com/shell.png)

To disable the shell (and just work with the API), comment out the following line in `exploit/main.js`:

	setupListener(sc);

API
===

Conventions
-----------

64-bit values (pointers, primarily) are represented using a JavaScript array containing `[lo, hi]`, where each is 32-bit.

Utility Functions
-----------------

- `paddr(address)` -- Convert a 64-bit value into a hex string representation
- `add2(a, b)` -- Adds two 64-bit values or adds a 64-bit value and a number
- `nullptr(address)` -- Returns true if the given 64-bit value is 0
- `eq(a, b)` -- Returns true if the two 64-bit values are equal
- `parseAddr(address)` -- Takes a hex string and parses into a 64-bit value

SploitCore
----------

Sploitcore is the centerpoint of PegaSwitch, providing all of the core functionality and most of the important API.  These are all methods on the sploitcore object.

- `dumpaddr(address, count)` -- Takes an address and a number of 32-bit values to log
- `read4(address, offset)` -- Reads a 32-bit value from `address + offset * 4`
- `read8(address, offset)` -- Reads a 64-bit value from `address + offset * 4`
- `write4(value, address, offset)` -- Writes a 32-bit value to `address + offset * 4`
- `write8(value, address, offset)` -- Writes a 64-bit value to `address + offset * 4`
- `memview(address, size, cb)` -- Calls `cb` with an ArrayBuffer pointing to the view of memory requested.  **DO NOT** keep that view or any object using it around; you will tank the GC and your Switch will crash
- `getAddr(obj)` -- Returns the address of a given JavaScript object
- `mref(offset)` -- Returns the address of the main module (the application binary itself) plus the given (32-bit) offset
- `getBase()` -- Returns the base address of WebKit
- `getSP()` -- Returns the current stack pointer (current as of a function call in JS), primarily useful for JOP/ROP chains
- `malloc(bytes)` -- Returns an address to an allocated buffer
- `free(addr)` -- Frees a buffer
- `bridge` and `call` -- Documented below
- `svc(id, registers, dump_regs)` -- Call a specific SVC, passing an array of registers and optionally dumping all regs (dump_regs == true/false)
- `getTLS()` -- Gets address of TLS
- `str2buf(str)` -- Allocates a buffer for a null-terminated string and returns the address
- `readString(addr, length)` -- Reads a string from `addr`.  If length is not passed or -1, the string is expected to be null-terminated
- `gc()` -- Force garbage collection

### Call

`sploitcore.call` allows you to call native functions by address.  It takes the following parameters, with the first being required:

- `address` - Function address. Either a 32-bit offset from the main module address, or a 64-bit absolute pointer
- `args` - Array of arguments, to go in x0+
- `fargs` - Array of floats, to go in d0+
- `registers` - Array of raw registers (x16 and x30 not assignable)
- `dump_regs` - Boolean to set whether registers should be dumped upon return

This function always returns the 64-bit value in x0.

### Bridge

Bridge allows you to wrap a native function into a JavaScript function.  Example:

	var strlen = sc.bridge(0x43A6E8, int, char_p);
	log(strlen('foo')); // Logs 3 to the console

The first parameter is the address (same format as `call`), second is the return type, the rest are arguments.

The following are valid types:

- `null` -- Used for `void` returns
- `int`
- `void_p` -- Arbitrary pointer
- `char_p` -- String pointer
- `float` -- Floating point argument; currently only supported for arguments, not returns
