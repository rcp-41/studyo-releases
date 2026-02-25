#!/usr/bin/env python3
"""
HWID Generator - Hardware-based License System
Studyo Manager Multi-Tenant SaaS

Bu script, çalıştırıldığı bilgisayarın benzersiz donanım kimliğini (HWID) üretir.
Electron uygulaması tarafından çağrılarak lisans doğrulamasında kullanılır.

Kullanım:
    python hwid_generator.py

Çıktı (JSON):
    {
        "hwid": "a1b2c3d4e5f6...",
        "cpu_id": "PROC123456",
        "disk_id": "DISK789012",
        "mac_address": "00:11:22:33:44:55",
        "platform": "Windows",
        "machine": "AMD64"
    }
"""

import subprocess
import hashlib
import uuid
import platform
import json
import sys


class HWIDGenerator:
    """Benzersiz donanım kimliği oluşturucu"""

    @staticmethod
    def get_cpu_id() -> str:
        """
        Windows'ta CPU Processor ID alır.
        Bu değer her CPU için benzersizdir ve değişmez.
        """
        try:
            if platform.system() == 'Windows':
                # SECURITY: shell=False with list arguments to prevent command injection
                output = subprocess.check_output(
                    ['wmic', 'cpu', 'get', 'ProcessorId'],
                    shell=False,
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                lines = output.split('\n')
                if len(lines) > 1:
                    return lines[1].strip()
            elif platform.system() == 'Linux':
                # Linux için /proc/cpuinfo
                with open('/proc/cpuinfo', 'r') as f:
                    for line in f:
                        if 'Serial' in line:
                            return line.split(':')[1].strip()
            elif platform.system() == 'Darwin':
                # macOS için
                output = subprocess.check_output(
                    ['sysctl', '-n', 'machdep.cpu.signature'],
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                return output
        except Exception as e:
            pass
        return 'UNKNOWN-CPU-' + str(uuid.uuid4())[:8]

    @staticmethod
    def get_disk_id() -> str:
        """
        Windows'ta birincil disk seri numarasını alır.
        Disk değişmediği sürece sabit kalır.
        """
        try:
            if platform.system() == 'Windows':
                # SECURITY: shell=False with list arguments
                output = subprocess.check_output(
                    ['wmic', 'diskdrive', 'get', 'SerialNumber'],
                    shell=False,
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                lines = output.split('\n')
                if len(lines) > 1:
                    return lines[1].strip().replace(' ', '')
            elif platform.system() == 'Linux':
                # Linux için blkid veya lsblk
                output = subprocess.check_output(
                    ['lsblk', '-o', 'SERIAL'],
                    shell=False,
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                lines = output.split('\n')
                for line in lines[1:]:
                    if line.strip():
                        return line.strip()
            elif platform.system() == 'Darwin':
                output = subprocess.check_output(
                    ['system_profiler', 'SPSerialATADataType'],
                    stderr=subprocess.DEVNULL
                ).decode()
                for line in output.split('\n'):
                    if 'Serial Number' in line:
                        return line.split(':')[1].strip()
        except Exception as e:
            pass
        return 'UNKNOWN-DISK-' + str(uuid.uuid4())[:8]

    @staticmethod
    def get_motherboard_id() -> str:
        """
        Windows'ta anakart seri numarasını alır.
        """
        try:
            if platform.system() == 'Windows':
                # SECURITY: shell=False with list arguments
                output = subprocess.check_output(
                    ['wmic', 'baseboard', 'get', 'serialnumber'],
                    shell=False,
                    stderr=subprocess.DEVNULL
                ).decode().strip()
                lines = output.split('\n')
                if len(lines) > 1:
                    serial = lines[1].strip()
                    if serial and serial.lower() not in ['to be filled by o.e.m.', 'default string', '']:
                        return serial
        except Exception:
            pass
        return None

    @staticmethod
    def get_mac_address() -> str:
        """
        Ağ adaptörünün MAC adresini alır.
        Her ağ kartı için benzersizdir.
        """
        try:
            mac = uuid.getnode()
            # MAC adresini formatla (AA:BB:CC:DD:EE:FF)
            mac_formatted = ':'.join(
                f'{(mac >> (8 * i)) & 0xff:02X}'
                for i in reversed(range(6))
            )
            return mac_formatted
        except Exception:
            return 'UNKNOWN-MAC'

    @classmethod
    def generate_hwid(cls) -> dict:
        """
        Tüm donanım bilgilerini birleştirip benzersiz HWID hash'i üretir.
        
        Returns:
            dict: HWID ve bileşen bilgileri
        """
        cpu_id = cls.get_cpu_id()
        disk_id = cls.get_disk_id()
        motherboard_id = cls.get_motherboard_id()
        mac = cls.get_mac_address()

        # Benzersiz bir string oluştur
        components = [cpu_id, disk_id, mac]
        if motherboard_id:
            components.append(motherboard_id)
        
        raw_string = '-'.join(components)
        
        # SHA-256 hash oluştur ve ilk 32 karakteri al
        hwid_hash = hashlib.sha256(raw_string.encode()).hexdigest()[:32].upper()

        return {
            'hwid': hwid_hash,
            'cpu_id': cpu_id,
            'disk_id': disk_id,
            'motherboard_id': motherboard_id,
            'mac_address': mac,
            'platform': platform.system(),
            'machine': platform.machine(),
            'node': platform.node()
        }


def verify_license(hwid: str, registered_hwid: str) -> bool:
    """
    HWID'nin kayıtlı HWID ile eşleşip eşleşmediğini kontrol eder.
    
    Args:
        hwid: Mevcut bilgisayarın HWID'si
        registered_hwid: Firebase'de kayıtlı HWID
        
    Returns:
        bool: Eşleşme durumu
    """
    return hwid.upper() == registered_hwid.upper()


if __name__ == '__main__':
    try:
        result = HWIDGenerator.generate_hwid()
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        error_result = {
            'error': str(e),
            'hwid': None
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)
