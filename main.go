package main

import "fmt"

type Engine struct {
	HorsePower int
}

func (e *Engine) start() {
	fmt.Println("Enginr started!")
}

type Car struct {
	Model string
	Engine
}

func (c *Car) Drive() {
	fmt.Printf("Driving my %s...\n", c.Model)
}

func main() {
	myCar := Car{
		Model:  "Atenza",
		Engine: Engine{HorsePower: 200},
	}

	myCar.start()
	myCar.Drive()
}
