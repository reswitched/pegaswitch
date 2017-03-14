#based on http://code.activestate.com/recipes/491264-mini-fake-dns-server/

import socket

class DNSQuery:
  def __init__(self, data):
    self.data=data
    self.domain=''

    qtype = (ord(data[2]) >> 3) & 15   # Opcode bits
    if qtype == 0:                     # Standard query
      index=12
      lon=ord(data[index])
      while lon != 0:
        self.domain+=data[index+1:index+lon+1]+'.'
        index+=lon+1
        lon=ord(data[index])

  def request(self, ip):
    packet=''
    if self.domain:
      packet+=self.data[:2] + "\x81\x80"
      packet+=self.data[4:6] + self.data[4:6] + '\x00\x00\x00\x00'   # Questions and Answers Counts
      packet+=self.data[12:]                                         # Original Domain Name Question
      packet+='\xc0\x0c'                                             # Pointer to domain name
      packet+='\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04'             # Response type, ttl and resource data length -> 4 bytes
      packet+=str.join('',map(lambda x: chr(int(x)), ip.split('.'))) # 4bytes of IP
    return packet

if __name__ == '__main__':
  ip=socket.gethostbyname(socket.gethostname())
  print 'DNS server started on %s' % ip
  
  udps = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  udps.bind(('',53))
  
  try:
    while 1:
      data, addr = udps.recvfrom(1024)
      p=DNSQuery(data)
      udps.sendto(p.request(ip), addr) #send answer
      print 'Accepted request: %s -> %s' % (p.domain, ip)
  except KeyboardInterrupt:
    udps.close()