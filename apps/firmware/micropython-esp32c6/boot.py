# boot.py -- runs on boot-up before main.py
import gc
gc.collect()

import main
main.run()
